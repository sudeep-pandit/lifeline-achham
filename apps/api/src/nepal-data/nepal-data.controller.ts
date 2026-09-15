import { Controller, Get, Param, Query } from "@nestjs/common";
import { NepalDataService } from "./nepal-data.service";
import { Public } from "../common/decorators/public.decorator";

// Public: the membership application form (Section 8) is reachable without
// login, so these dropdown-data endpoints must be too. They expose only
// names/ids — no organization or member data.
@Controller("nepal-data")
@Public()
export class NepalDataController {
  constructor(private readonly nepalDataService: NepalDataService) {}

  @Get("districts")
  districts() {
    return this.nepalDataService.findDistricts();
  }

  @Get("municipalities")
  municipalities(@Query("districtId") districtId: string) {
    return this.nepalDataService.findMunicipalities(districtId);
  }

  @Get("wards")
  wards(@Query("municipalityId") municipalityId: string) {
    return this.nepalDataService.wardNumbers(municipalityId);
  }
}
