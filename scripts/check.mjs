import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.case.count();
  const cases = await prisma.case.findMany({ select: { id: true, caseNumber: true } });
  console.log("CASE COUNT:", count);
  console.log("CASES:", cases);
}
main().finally(() => prisma.$disconnect());
