import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Read-only reference data for the dependent District -> Municipality ->
// Ward -> Tole dropdowns (Section 8). Structured as real tables (not a
// hard-coded frontend array) so it can be extended later, per the spec.
@Injectable()
export class NepalDataService {
  constructor(private readonly prisma: PrismaService) {}

  findDistricts() {
    return this.prisma.district.findMany({ orderBy: { displayOrder: "asc" } });
  }

  findMunicipalities(districtId: string) {
    return this.prisma.municipality.findMany({
      where: { districtId },
      orderBy: { name: "asc" },
    });
  }

  async wardNumbers(municipalityId: string): Promise<number[]> {
    const m = await this.prisma.municipality.findUnique({ where: { id: municipalityId } });
    if (!m) return [];
    return Array.from({ length: m.wardCount }, (_, i) => i + 1);
  }
}
