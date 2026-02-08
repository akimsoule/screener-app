import "dotenv/config";
import { prisma } from "../src/app/lib/prisma.js";

try {
  const symbols = await prisma.symbol.findMany({
    where: { isPopular: true, enabled: true },
    select: {
      id: true,
      name: true,
      symbolType: true,
      metadata: true,
      isPopular: true,
      enabled: true,
    },
  });
  console.log(`Found ${symbols.length} popular symbols:`);
  console.log(JSON.stringify(symbols, null, 2));
} catch (error) {
  console.error("Error fetching symbols:", error);
} finally {
  await prisma.$disconnect();
  process.exit(0);
}
