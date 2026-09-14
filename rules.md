# System Rules & Development Constraints

## 1. Forensic Integrity Rules
1. **Never mutate uploaded files:** Any format conversion, thumbnail generation, or compression must occur on working buffers. Original files must retain identical SHA-256 signatures.
2. **Zero Unanchored Assertions:** The AI engine is prohibited from making assertions without an attached `evidence_id`. If a claim cannot be referenced to an uploaded image/chat line, it must be discarded.

## 2. Legal Boundaries (Guardrails)
1. **No Legal Arbitrator Claims:** The platform is an "Investigative Intelligence Tool." Never use wording claiming the system "convicts," "proves guilt," or "automatically registers FIRs."
2. **Use Qualified Language:** Output must state *"Potential Syndicate Match Detected"* or *"High-Risk Common Identifier"* instead of *"Confirmed Scammer Network."*

## 3. Hackathon Engineering Rules
1. **Mock Smartly, Build Real:**
   * Keep a seeded database of 5 realistic existing scam cases containing shared mock UPI IDs (`badguy@okicici`, `mule88@oksbi`) and phone numbers (`+919876543210`).
   * When the judge uploads demo files with these identifiers, the graph engine must deterministically link the new case to the 5 seeded cases.
2. **Speed Over Scale:** Run graph resolution in-memory (JSON adjacency lists) if database graph configuration creates local deployment overhead.
