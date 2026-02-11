/**
 * KNOWAA Global Travel Network — Skills Configuration
 * Each skill defines a customer service capability with its trigger patterns,
 * instructions, and response templates.
 */

export type Skill = {
  id: string;
  name: string;
  nameHe: string;
  description: string;
  triggerKeywords: string[];
  instructions: string;
  responseTemplate?: string;
  requiresBookingRef?: boolean;
  escalationThreshold?: string;
};

const skills: Skill[] = [
  // === ACCOMMODATION ===
  {
    id: "hotel_search",
    name: "Hotel & Accommodation Search",
    nameHe: "חיפוש מלונות",
    description: "Help partners find luxury hotels and villas in Miami and Bahamas",
    triggerKeywords: ["hotel", "accommodation", "villa", "resort", "stay", "room", "מלון", "לינה", "וילה", "נופש", "miami beach", "bahamas"],
    instructions: `For accommodation inquiries:
1. Ask for: destination (Miami/Miami Beach/Bahamas), dates, number of guests, budget range
2. Highlight our Luxury Hotel Program with exclusive rates and allotments
3. Mention private buyout and villa access options for larger groups
4. Emphasize VIP amenities available through our partnerships
5. Note that we offer carefully selected premium accommodations aligned with partner brand standards
6. If specific availability isn't in the knowledge base, offer to connect with the team`,
  },
  {
    id: "booking_lookup",
    name: "Booking Lookup",
    nameHe: "חיפוש הזמנה",
    description: "Look up booking details by reference number",
    triggerKeywords: ["booking", "reservation", "confirmation", "הזמנה", "אישור", "reference"],
    instructions: `When a partner asks about a specific booking:
1. Ask for the booking reference number if not provided
2. Search the knowledge base for booking-related policies
3. Provide relevant information about booking status, dates, property, and services
4. If you cannot find the booking details in the context, escalate with the reference number`,
    requiresBookingRef: true,
  },
  {
    id: "booking_modification",
    name: "Booking Modification",
    nameHe: "שינוי הזמנה",
    description: "Handle date changes, property upgrades, guest changes",
    triggerKeywords: ["change", "modify", "amendment", "update booking", "שינוי", "עדכון", "upgrade"],
    instructions: `For booking modifications:
1. Ask for booking reference number
2. Identify what needs to change (dates, property, guest name, services)
3. Explain the modification policy from the knowledge base
4. Note any fees or rate differences that may apply
5. Mention our 24/7 concierge team can handle real-time itinerary adjustments
6. Provide step-by-step instructions for submitting the modification`,
    requiresBookingRef: true,
  },
  {
    id: "booking_cancellation",
    name: "Cancellation & Refunds",
    nameHe: "ביטול והחזרים",
    description: "Process cancellations and explain refund policies",
    triggerKeywords: ["cancel", "cancellation", "refund", "ביטול", "החזר"],
    instructions: `For cancellation requests:
1. Ask for booking reference number
2. Check the cancellation policy in the knowledge base
3. Explain the cancellation fee structure clearly
4. Distinguish between refundable and non-refundable rates
5. Provide the exact deadline for free cancellation
6. Explain the refund timeline and method`,
    requiresBookingRef: true,
  },

  // === EXPERIENCES & SERVICES ===
  {
    id: "yacht_charter",
    name: "Yacht Charters & Water Experiences",
    nameHe: "שייט ויאכטות",
    description: "Yacht charters, boat trips, and water activities",
    triggerKeywords: ["yacht", "boat", "charter", "cruise", "sailing", "water", "ocean", "sea", "יאכטה", "שייט", "ספינה"],
    instructions: `For yacht and water experience inquiries:
1. Highlight our Premium Experience Network yacht charter options
2. Ask for: group size, preferred date, duration, any special occasions
3. Mention sunset yacht cruises as a signature experience
4. Explain available yacht sizes and configurations
5. Note that we can arrange private beach club access along with yacht experiences
6. Emphasize that these are curated, exclusive experiences most visitors never discover`,
  },
  {
    id: "dining_experience",
    name: "Dining & Restaurant Bookings",
    nameHe: "מסעדות וחוויות קולינריות",
    description: "Hard-to-book restaurants and culinary experiences",
    triggerKeywords: ["restaurant", "dining", "food", "culinary", "reservation", "eat", "מסעדה", "אוכל", "ארוחה"],
    instructions: `For dining inquiries:
1. Highlight our access to hard-to-book restaurants in Miami
2. Ask for: cuisine preferences, group size, date, budget, dietary requirements
3. Mention reservation-only restaurants in our network
4. Offer curated culinary tour options
5. Note that our concierge team can secure last-minute dining reservations 24/7
6. Emphasize the local expertise that goes beyond typical tourist spots`,
  },
  {
    id: "cultural_experiences",
    name: "Cultural & VIP Experiences",
    nameHe: "חוויות תרבות ו-VIP",
    description: "Private cultural events, tours, and exclusive experiences",
    triggerKeywords: ["experience", "tour", "cultural", "event", "VIP", "exclusive", "private", "סיור", "חוויה", "אירוע", "Wynwood", "art", "nightlife"],
    instructions: `For cultural and VIP experience inquiries:
1. Highlight unique experiences: private beach clubs, cultural events, local hidden gems
2. Mention specific Miami areas: Wynwood arts district, South Beach, Coconut Grove
3. Ask for: interests, group size, preferred dates, budget
4. Offer private cultural events and guided tours
5. Emphasize that our local connections unlock doors to exclusive experiences
6. Note available nightlife and entertainment options`,
  },
  {
    id: "transfer_transport",
    name: "Transfers & Transportation",
    nameHe: "העברות ותחבורה",
    description: "Airport transfers, private cars, and transportation",
    triggerKeywords: ["transfer", "airport", "transport", "car", "driver", "pickup", "taxi", "limo", "העברה", "תחבורה", "שדה תעופה"],
    instructions: `For transfer and transportation inquiries:
1. Ask for: origin, destination, date/time, number of passengers, luggage needs
2. Explain available transfer options (private car, luxury vehicle, group transport)
3. Mention airport pickup/drop-off services
4. Note that our concierge handles real-time itinerary changes including transportation
5. For inter-island transfers (Miami to Bahamas), explain available options`,
  },
  {
    id: "beach_clubs",
    name: "Beach Clubs & Day Experiences",
    nameHe: "מועדוני חוף",
    description: "Private beach clubs and daytime leisure activities",
    triggerKeywords: ["beach", "pool", "club", "day", "spa", "relax", "חוף", "בריכה", "ספא"],
    instructions: `For beach and leisure inquiries:
1. Highlight private beach club access through our network
2. Ask for: date, group size, preferences (active vs relaxation)
3. Mention spa and wellness options at partner properties
4. Offer curated day experience packages
5. Note hidden beaches in the Bahamas that we can arrange access to
6. Emphasize the premium, curated nature of our beach experiences`,
  },

  // === ITINERARY & PLANNING ===
  {
    id: "itinerary_design",
    name: "Custom Itinerary Design",
    nameHe: "עיצוב מסלול מותאם",
    description: "Bespoke itinerary creation for clients",
    triggerKeywords: ["itinerary", "plan", "schedule", "trip", "program", "מסלול", "תכנון", "טיול", "תוכנית"],
    instructions: `For itinerary design requests:
1. Emphasize that we design bespoke itineraries bringing client visions to life
2. Ask for: travel dates, group composition, interests, budget range, special occasions
3. Explain our personalized approach — every detail reflects care and quality
4. Mention that our deep local expertise covers Miami, South Florida, and the Bahamas
5. Offer examples of experiences we can weave into itineraries
6. Note our 24/7 support for real-time itinerary adjustments during the trip`,
  },
  {
    id: "group_travel",
    name: "Group & Corporate Travel",
    nameHe: "קבוצות ונסיעות עסקיות",
    description: "Group bookings, corporate events, and incentive travel",
    triggerKeywords: ["group", "corporate", "incentive", "team", "event", "conference", "meeting", "קבוצה", "ארגוני", "כנס"],
    instructions: `For group and corporate travel:
1. Ask for: group size, dates, purpose (incentive, conference, team building)
2. Mention private buyout options for hotels and venues
3. Highlight our ability to coordinate complex group logistics
4. Offer curated team building activities and private events
5. Emphasize white-label solutions available for corporate partners
6. Note volume-based incentives for larger groups`,
  },

  // === PARTNERSHIP & BUSINESS ===
  {
    id: "partnership_info",
    name: "Partnership Program",
    nameHe: "תוכנית שותפות",
    description: "Partnership program details, benefits, and how to join",
    triggerKeywords: ["partner", "partnership", "join", "collaborate", "שותף", "שותפות", "הצטרפות"],
    instructions: `For partnership inquiries:
1. Explain the KNOWAA Global partnership benefits:
   - Guaranteed allocations at luxury hotels
   - Pre-negotiated rates at exclusive venues
   - Priority access to high-demand experiences
2. Mention seamless integration with major booking systems and white-label solutions
3. Highlight the competitive commission structure and volume-based incentives
4. Note the dedicated account manager and 24/7 multilingual support
5. Explain the revenue growth opportunities through upsells
6. Direct to the partnership page or provide contact info`,
  },
  {
    id: "commission_rates",
    name: "Commission & Revenue",
    nameHe: "עמלות והכנסות",
    description: "Commission structures and revenue opportunities",
    triggerKeywords: ["commission", "revenue", "earnings", "markup", "margin", "עמלה", "רווח", "הכנסות"],
    instructions: `For commission inquiries:
1. Explain the competitive commission structure
2. Mention volume-based incentives for high-performing partners
3. Highlight upsell opportunities for premium experiences
4. NEVER reveal other partners' commission rates or terms
5. Direct negotiation requests to the partnership team
6. Provide info@knowaaglobal.com for detailed commission discussions`,
  },
  {
    id: "payment_invoicing",
    name: "Payment & Invoicing",
    nameHe: "תשלום וחשבוניות",
    description: "Handle payment terms, invoicing, and billing queries",
    triggerKeywords: ["payment", "invoice", "billing", "credit", "תשלום", "חשבונית", "אשראי", "bank transfer"],
    instructions: `For payment and invoicing:
1. Explain available payment methods
2. Clarify payment terms and deadlines
3. Explain the invoicing cycle and format
4. Help with missing or incorrect invoices
5. For payment disputes, collect details and escalate
6. Direct to info@knowaaglobal.com for billing queries`,
  },

  // === DESTINATIONS ===
  {
    id: "miami_info",
    name: "Miami & South Florida Guide",
    nameHe: "מדריך מיאמי",
    description: "Local knowledge about Miami, Miami Beach, and South Florida",
    triggerKeywords: ["miami", "south florida", "brickell", "wynwood", "south beach", "coconut grove", "coral gables", "key biscayne", "fort lauderdale", "מיאמי"],
    instructions: `For Miami and South Florida inquiries:
1. Share local expertise about Miami's diverse neighborhoods and attractions
2. Highlight: iconic beaches, vibrant arts districts, world-class dining, nightlife
3. Mention specific areas: Wynwood, South Beach, Brickell, Coconut Grove, Coral Gables
4. Emphasize our deep local knowledge that goes beyond tourist hotspots
5. Note that we can arrange authentic local experiences with our personal connections
6. Offer to design a customized experience based on client interests`,
  },
  {
    id: "bahamas_info",
    name: "Bahamas Guide",
    nameHe: "מדריך באהמאס",
    description: "Local knowledge about the Bahamas islands",
    triggerKeywords: ["bahamas", "nassau", "island", "caribbean", "bahama", "באהמאס", "איים"],
    instructions: `For Bahamas inquiries:
1. Share expertise about Bahamas destinations and island experiences
2. Highlight hidden beaches and exclusive island experiences
3. Mention seamless island getaway coordination from Miami
4. Note that we know every corner worth exploring in the Bahamas
5. Offer yacht charter options for island hopping
6. Emphasize the authenticity and style of our Bahamas experiences`,
  },

  // === SUPPORT ===
  {
    id: "concierge_services",
    name: "Concierge & 24/7 Support",
    nameHe: "קונסיירז' ותמיכה",
    description: "24/7 multilingual concierge services during stay",
    triggerKeywords: ["concierge", "support", "help", "assist", "24/7", "multilingual", "language", "קונסיירז'", "תמיכה", "עזרה"],
    instructions: `For concierge service inquiries:
1. Highlight our 24/7 travel assistance during stay
2. Emphasize multilingual support in 14 languages
3. Explain services: last-minute reservations, itinerary adjustments, crisis response
4. Mention our dedicated crisis response team
5. Note that we ensure seamless and exceptional experience for clients
6. Provide WhatsApp contact: +1 786-452-4140 for immediate assistance`,
  },
  {
    id: "complaint",
    name: "Complaint Handling",
    nameHe: "טיפול בתלונות",
    description: "Handle complaints about service or experiences",
    triggerKeywords: ["complaint", "problem", "issue", "unhappy", "disappointed", "תלונה", "בעיה", "לא מרוצה"],
    instructions: `For complaints:
1. Acknowledge the issue empathetically and professionally
2. Ask for specific details: booking reference, dates, what happened
3. Classify the complaint type (service, property, experience, billing)
4. Explain the complaint resolution process
5. Provide expected resolution timeline
6. If urgent (client currently on trip), treat as high priority and escalate immediately
7. Always end with reassurance that the issue will be handled`,
  },
  {
    id: "emergency",
    name: "Emergency & Urgent",
    nameHe: "חירום ודחוף",
    description: "Handle urgent situations requiring immediate attention",
    triggerKeywords: ["urgent", "emergency", "ASAP", "now", "immediately", "דחוף", "חירום", "מיידי", "עכשיו"],
    instructions: `For urgent/emergency requests:
1. Identify the urgency level (client on trip now, same-day issue, safety concern)
2. Provide immediate action steps if available
3. Always escalate with URGENT flag
4. Provide direct contact: WhatsApp +1 786-452-4140
5. Follow up: "This has been flagged as URGENT. Our team will respond immediately."
6. For safety emergencies, provide local emergency numbers (911 in US)`,
    escalationThreshold: "always",
  },
];

/**
 * Detects which skills are relevant to a user's question based on keyword matching.
 */
const detectSkills = (question: string): Skill[] => {
  const lowerQuestion = question.toLowerCase();
  return skills.filter((skill) =>
    skill.triggerKeywords.some((keyword) =>
      lowerQuestion.includes(keyword.toLowerCase())
    )
  );
};

/**
 * Builds the skill-specific instructions to inject into the system prompt.
 */
const buildSkillContext = (detectedSkills: Skill[]): string => {
  if (detectedSkills.length === 0) return "";

  const skillInstructions = detectedSkills
    .map(
      (s) =>
        `### Skill: ${s.name} (${s.nameHe})\n${s.instructions}${s.requiresBookingRef ? "\n**Important: Ask for booking reference number if not provided.**" : ""}${s.escalationThreshold === "always" ? "\n**Always escalate this type of request.**" : ""}`
    )
    .join("\n\n");

  return `\n\n## Active Skills for This Query\nThe following specialized skills are activated for this question. Follow their instructions:\n\n${skillInstructions}\n`;
};

/**
 * Returns all skills for display in admin dashboard.
 */
const getAllSkills = (): Skill[] => skills;

export { skills, detectSkills, buildSkillContext, getAllSkills };
