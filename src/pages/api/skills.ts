import type { NextApiRequest, NextApiResponse } from "next";
import { getAllSkills, detectSkills } from "../../lib/skills";

/**
 * Returns all configured skills, or detects skills for a given query.
 * GET /api/skills — returns all skills
 * GET /api/skills?q=test+question — returns detected skills for the question
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const query = req.query.q as string | undefined;

  if (query) {
    const detected = detectSkills(query);
    res.status(200).json({
      query,
      detectedSkills: detected.map((s) => ({
        id: s.id,
        name: s.name,
        nameHe: s.nameHe,
      })),
      count: detected.length,
    });
    return;
  }

  const allSkills = getAllSkills();
  res.status(200).json({
    skills: allSkills.map((s) => ({
      id: s.id,
      name: s.name,
      nameHe: s.nameHe,
      description: s.description,
      triggerKeywords: s.triggerKeywords,
      requiresBookingRef: s.requiresBookingRef || false,
      escalationThreshold: s.escalationThreshold || "none",
    })),
    count: allSkills.length,
  });
}
