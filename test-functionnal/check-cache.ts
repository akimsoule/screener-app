import { prisma } from "../src/app/lib/prisma";

try {
  const caches = await prisma.cache.findMany({
    where: {
      key: {
        contains: "AAPL",
      },
    },
    select: {
      key: true,
      category: true,
    },
  });

  console.log(`Found ${caches.length} cache entries for AAPL:`);
  caches.forEach((c) => console.log(`  - ${c.key} (${c.category})`));
} catch (error) {
  console.error("Error checking cache:", error);
} finally {
  await prisma.$disconnect();
  process.exit(0);
}
