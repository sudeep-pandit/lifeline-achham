// Starter Nepal administrative reference data (Section 8). All 77 districts
// are seeded by name so every district appears in the application form's
// dropdown. Full municipality-level data is seeded for Achham (Lifeline
// Achham's home district) as a real, complete example; other districts'
// municipalities can be added the same way, through this table, without
// any schema or code change - see NepalDataService.
//
// Source: districts and their province groupings, and Achham District's
// local levels, per the Government of Nepal's post-2017 restructuring
// (Constitution of Nepal, Schedule 4).

export const DISTRICTS: string[] = [
  // Koshi Province
  "Bhojpur", "Dhankuta", "Ilam", "Jhapa", "Khotang", "Morang", "Okhaldhunga",
  "Panchthar", "Sankhuwasabha", "Solukhumbu", "Sunsari", "Taplejung", "Tehrathum", "Udayapur",
  // Madhesh Province
  "Parsa", "Bara", "Rautahat", "Sarlahi", "Dhanusha", "Siraha", "Mahottari", "Saptari",
  // Bagmati Province
  "Sindhuli", "Ramechhap", "Dolakha", "Bhaktapur", "Dhading", "Kathmandu", "Kavrepalanchok",
  "Lalitpur", "Nuwakot", "Rasuwa", "Sindhupalchok", "Chitwan", "Makwanpur",
  // Gandaki Province
  "Baglung", "Gorkha", "Kaski", "Lamjung", "Manang", "Mustang", "Myagdi",
  "Nawalpur", "Parbat", "Syangja", "Tanahun",
  // Lumbini Province
  "Kapilvastu", "Nawalparasi (West)", "Rupandehi", "Arghakhanchi", "Gulmi", "Palpa",
  "Dang", "Pyuthan", "Rolpa", "Eastern Rukum", "Banke", "Bardiya",
  // Karnali Province
  "Western Rukum", "Salyan", "Dolpa", "Humla", "Jumla", "Kalikot", "Mugu",
  "Surkhet", "Dailekh", "Jajarkot",
  // Sudurpashchim Province
  "Kailali", "Achham", "Doti", "Bajhang", "Bajura", "Kanchanpur", "Dadeldhura", "Baitadi", "Darchula",
];

// Ward counts below are typical for these local levels but not individually
// re-verified against each municipality's current ward-restructuring notice;
// confirm against the Election Commission's local level data before relying
// on them for anything beyond form dropdowns.
export const ACHHAM_MUNICIPALITIES: { name: string; type: "MUNICIPALITY" | "RURAL_MUNICIPALITY"; wardCount: number }[] = [
  { name: "Mangalsen Municipality", type: "MUNICIPALITY", wardCount: 10 },
  { name: "Kamalbazar Municipality", type: "MUNICIPALITY", wardCount: 9 },
  { name: "Sanfebagar Municipality", type: "MUNICIPALITY", wardCount: 10 },
  { name: "Panchadewal Binayak Municipality", type: "MUNICIPALITY", wardCount: 9 },
  { name: "Chaurpati Rural Municipality", type: "RURAL_MUNICIPALITY", wardCount: 6 },
  { name: "Bannigadhi Jayagadh Rural Municipality", type: "RURAL_MUNICIPALITY", wardCount: 8 },
  { name: "Dhakari Rural Municipality", type: "RURAL_MUNICIPALITY", wardCount: 6 },
  { name: "Ramaroshan Rural Municipality", type: "RURAL_MUNICIPALITY", wardCount: 8 },
  { name: "Turmakhad Rural Municipality", type: "RURAL_MUNICIPALITY", wardCount: 6 },
  { name: "Mellekh Rural Municipality", type: "RURAL_MUNICIPALITY", wardCount: 6 },
];
