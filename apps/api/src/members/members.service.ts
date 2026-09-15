import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { UpdateMemberDto } from "./dto/update-member.dto";
import { CreateMemberDto } from "./dto/create-member.dto";

export interface MemberFilters {
  search?: string;
  membershipTypeId?: string;
  districtId?: string;
  status?: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED";
  page?: number;
  pageSize?: number;
}

const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3MB raw (~4MB as base64)
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/jpg", "image/png"];

// Section: "Proper image validation" - checked here (not just trusted from
// the client) since this is a server boundary accepting arbitrary base64.
function validatePhoto(dataUrl: string | undefined): string | undefined {
  if (!dataUrl) return dataUrl;
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new BadRequestException("Profile photo must be a valid image data URL");
  const [, mimeType, base64Data] = match;
  if (!ALLOWED_PHOTO_TYPES.includes(mimeType)) {
    throw new BadRequestException("Profile photo must be a JPG or PNG image");
  }
  const approxBytes = (base64Data.length * 3) / 4;
  if (approxBytes > MAX_PHOTO_BYTES) {
    throw new BadRequestException("Profile photo must be under 3MB");
  }
  return dataUrl;
}

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  // Derives ACTIVE / EXPIRING_SOON / EXPIRED from expiresAt at read time
  // rather than a stored, driftable status column (Section 26).
  private computeStatus(expiresAt: Date | null, expiringSoonDays: number): "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" {
    if (!expiresAt) return "ACTIVE"; // lifetime
    const now = Date.now();
    if (expiresAt.getTime() < now) return "EXPIRED";
    const soonThreshold = now + expiringSoonDays * 24 * 60 * 60 * 1000;
    return expiresAt.getTime() <= soonThreshold ? "EXPIRING_SOON" : "ACTIVE";
  }

  async findAll(organizationId: string, filters: MemberFilters) {
    const settings = await this.prisma.organizationSettings.findUnique({ where: { organizationId } });
    const expiringSoonDays = settings?.expiringSoonDays ?? 30;

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.member.findMany({
        where: {
          organizationId,
          deletedAt: null,
          membershipTypeId: filters.membershipTypeId,
          districtId: filters.districtId,
          OR: filters.search
            ? [
                { fullName: { contains: filters.search, mode: "insensitive" } },
                { memberId: { contains: filters.search, mode: "insensitive" } },
                { email: { contains: filters.search, mode: "insensitive" } },
                { mobile: { contains: filters.search } },
              ]
            : undefined,
        },
        include: { membershipType: true, district: true, municipality: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.member.count({ where: { organizationId, deletedAt: null } }),
    ]);

    const withStatus = items
      .map((m) => ({ ...m, status: this.computeStatus(m.expiresAt, expiringSoonDays) }))
      .filter((m) => !filters.status || m.status === filters.status);

    return { items: withStatus, total, page, pageSize };
  }

  async findOne(organizationId: string, id: string) {
    const member = await this.prisma.member.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { membershipType: true, district: true, municipality: true, application: true },
    });
    if (!member) throw new NotFoundException("Member not found");
    return member;
  }

  async update(organizationId: string, id: string, dto: UpdateMemberDto) {
    const member = await this.prisma.member.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!member) throw new NotFoundException("Member not found");

    // Changing membership type recomputes price/expiry from the new type,
    // the same as at creation - never left stale/mismatched with the type
    // actually stored on the record.
    let membershipPrice: any;
    let expiresAt: Date | null | undefined;
    if (dto.membershipTypeId && dto.membershipTypeId !== member.membershipTypeId) {
      const membershipType = await this.prisma.membershipType.findFirst({
        where: { id: dto.membershipTypeId, organizationId, isActive: true },
      });
      if (!membershipType) throw new BadRequestException("Selected membership type is not available");
      membershipPrice = membershipType.price;
      expiresAt = membershipType.durationDays
        ? new Date(member.membershipDate.getTime() + membershipType.durationDays * 24 * 60 * 60 * 1000)
        : null;
    }

    return this.prisma.member.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
        email: dto.email,
        mobile: dto.mobile,
        countryCode: dto.countryCode,
        districtId: dto.districtId,
        municipalityId: dto.municipalityId,
        wardNo: dto.wardNo,
        tole: dto.tole,
        remarks: dto.remarks,
        bloodGroup: dto.bloodGroup,
        socialLinks: dto.socialLinks as any,
        membershipTypeId: dto.membershipTypeId,
        membershipPrice,
        expiresAt,
        // Empty string means "remove the photo" - store as null, not "".
        profilePhotoUrl: dto.profilePhotoUrl === "" ? null : validatePhoto(dto.profilePhotoUrl),
      },
      include: { membershipType: true, district: true, municipality: true },
    });
  }

  // Direct staff registration (Section 6/8's "Member registration" role
  // capability, distinct from the public application flow) - no online
  // application or payment involved. Deliberately does NOT create a
  // Payment/Income row itself; if the walk-in paid, staff log that
  // separately on the Finance page so every financial record stays
  // something a human explicitly entered (Section 48).
  async create(organizationId: string, createdById: string, dto: CreateMemberDto) {
    const membershipType = await this.prisma.membershipType.findFirst({
      where: { id: dto.membershipTypeId, organizationId, isActive: true },
    });
    if (!membershipType) throw new BadRequestException("Selected membership type is not available");

    const memberId = await this.organizationsService.nextSequenceNumber(organizationId, "membership_id", "LA-LM");

    const expiresAt = membershipType.durationDays
      ? new Date(Date.now() + membershipType.durationDays * 24 * 60 * 60 * 1000)
      : null;

    return this.prisma.member.create({
      data: {
        organizationId,
        memberId,
        fullName: dto.fullName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        districtId: dto.districtId,
        municipalityId: dto.municipalityId,
        wardNo: dto.wardNo,
        tole: dto.tole,
        email: dto.email,
        mobile: dto.mobile,
        countryCode: dto.countryCode ?? "+977",
        bloodGroup: dto.bloodGroup,
        profilePhotoUrl: validatePhoto(dto.profilePhotoUrl),
        socialLinks: dto.socialLinks as any,
        membershipTypeId: dto.membershipTypeId,
        membershipDate: new Date(),
        membershipPrice: membershipType.price,
        expiresAt,
        approvalStatus: "APPROVED",
        approvedById: createdById,
        approvedAt: new Date(),
        remarks: dto.remarks,
      },
      include: { membershipType: true, district: true, municipality: true },
    });
  }
}
