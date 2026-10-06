// DEMO CONTENT for the landing page. Profiles, testimonials and impact figures
// below are illustrative sample data — replace them with real figures (or wire
// them to src/lib/stats.ts) before launching publicly.

export interface SampleStudent {
  name: string;
  countryCode: string;
  university: string;
  program: string;
  degree: "undergraduate" | "masters" | "phd";
  field: string;
  term: number;
  totalTerms: number;
  story: string;
  target: number;
  confirmed: number;
  pending: number;
  currency: string;
  supporters: number;
  hue: number;
}

export const sampleStudents: SampleStudent[] = [
  {
    name: "Wanjiru Kamau",
    countryCode: "KE",
    university: "University of Nairobi",
    program: "BSc Computer Science",
    degree: "undergraduate",
    field: "Computer Science",
    term: 5,
    totalTerms: 8,
    story: "First in my family at university. I'm building tools that help smallholder farmers get fair prices for their harvest.",
    target: 145000,
    confirmed: 98600,
    pending: 18000,
    currency: "KES",
    supporters: 7,
    hue: 24,
  },
  {
    name: "Arjun Mehta",
    countryCode: "IN",
    university: "University of Delhi",
    program: "MSc Public Health",
    degree: "masters",
    field: "Public Health",
    term: 2,
    totalTerms: 4,
    story: "After losing my grandmother to a preventable illness, I want to strengthen rural clinics across northern India.",
    target: 92000,
    confirmed: 71500,
    pending: 0,
    currency: "INR",
    supporters: 5,
    hue: 172,
  },
  {
    name: "Chiamaka Okafor",
    countryCode: "NG",
    university: "University of Lagos",
    program: "BEng Civil Engineering",
    degree: "undergraduate",
    field: "Engineering",
    term: 6,
    totalTerms: 10,
    story: "I want to design flood-resilient housing for coastal communities in Lagos. Two years left to make it happen.",
    target: 480000,
    confirmed: 210000,
    pending: 60000,
    currency: "NGN",
    supporters: 4,
    hue: 330,
  },
  {
    name: "Ayesha Siddiqui",
    countryCode: "PK",
    university: "Lahore University of Management Sciences",
    program: "PhD Economics",
    degree: "phd",
    field: "Economics",
    term: 3,
    totalTerms: 8,
    story: "Researching microfinance for women-led businesses. My work has already shaped a provincial lending pilot.",
    target: 610000,
    confirmed: 512000,
    pending: 40000,
    currency: "PKR",
    supporters: 9,
    hue: 262,
  },
  {
    name: "Mateo Hernández",
    countryCode: "CO",
    university: "Universidad Nacional de Colombia",
    program: "BSc Environmental Science",
    degree: "undergraduate",
    field: "Environmental Science",
    term: 4,
    totalTerms: 10,
    story: "Growing up next to the Magdalena river, I saw it change. I'm studying how to restore its wetlands.",
    target: 4200000,
    confirmed: 1550000,
    pending: 300000,
    currency: "COP",
    supporters: 3,
    hue: 140,
  },
  {
    name: "Linh Nguyen",
    countryCode: "VN",
    university: "Vietnam National University",
    program: "BSc Nursing",
    degree: "undergraduate",
    field: "Nursing",
    term: 7,
    totalTerms: 8,
    story: "One term from graduating as a nurse. I'll be the first healthcare worker in my village in Ha Giang.",
    target: 18500000,
    confirmed: 16400000,
    pending: 1200000,
    currency: "VND",
    supporters: 11,
    hue: 200,
  },
];

export const partnerUniversities = [
  "University of Nairobi",
  "University of Lagos",
  "Makerere University",
  "University of Ghana",
  "University of Delhi",
  "LUMS",
  "Dhaka University",
  "Universidad Nacional de Colombia",
  "Universidad de Buenos Aires",
  "Vietnam National University",
  "Addis Ababa University",
  "University of Cape Town",
  "Cairo University",
  "Universitas Indonesia",
];

export const impactStats = {
  fundedUsd: 4_820_000,
  students: 1_640,
  countries: 58,
  universities: 312,
  toUniversityPct: 100,
  graduates: 212,
};

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  countryCode: string;
  kind: "student" | "donor" | "university";
  hue: number;
}

export const testimonials: Testimonial[] = [
  {
    quote: "I was one semester away from dropping out. Four strangers paid my fees directly to the university — I graduated with honours last June and now teach chemistry in my hometown.",
    name: "Grace Achieng",
    role: "BSc Chemistry graduate, Makerere University",
    countryCode: "UG",
    kind: "student",
    hue: 12,
  },
  {
    quote: "What convinced me was the receipt. I can see exactly when the university was paid, and every term I get Arjun's results. It feels like mentoring, not just donating.",
    name: "Sarah Whitfield",
    role: "Donor since 2024",
    countryCode: "GB",
    kind: "donor",
    hue: 220,
  },
  {
    quote: "Payments arrive with the student's ID and invoice number, so reconciliation takes minutes. It's the cleanest sponsorship channel we work with.",
    name: "Daniel Mensah",
    role: "Bursar, University of Ghana",
    countryCode: "GH",
    kind: "university",
    hue: 150,
  },
  {
    quote: "I pay the university directly from my bank in Toronto and upload the confirmation. Simple, and I know the money can't go anywhere else.",
    name: "Priya Raman",
    role: "Donor, sponsoring 3 students",
    countryCode: "CA",
    kind: "donor",
    hue: 300,
  },
  {
    quote: "Posting my grades every term keeps me accountable. My sponsor messaged me after my exams — it meant more than I can say.",
    name: "Tomás Rojas",
    role: "BEng student, Universidad de Buenos Aires",
    countryCode: "AR",
    kind: "student",
    hue: 40,
  },
  {
    quote: "Our family fund gives through the platform in euros. Renewing each term is one click, and the reports make our annual review easy.",
    name: "Hannah Becker",
    role: "Becker Family Foundation",
    countryCode: "DE",
    kind: "donor",
    hue: 190,
  },
];
