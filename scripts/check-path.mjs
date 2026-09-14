import fs from "fs";
import path from "path";

console.log("Root dev.db exists:", fs.existsSync(path.resolve("dev.db")));
console.log("Prisma dev.db exists:", fs.existsSync(path.resolve("prisma/dev.db")));
if (fs.existsSync(path.resolve("prisma/dev.db"))) {
  console.log("Prisma dev.db size:", fs.statSync(path.resolve("prisma/dev.db")).size);
}
if (fs.existsSync(path.resolve("dev.db"))) {
  console.log("Root dev.db size:", fs.statSync(path.resolve("dev.db")).size);
}
