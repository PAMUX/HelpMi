// Test-only stub for @prisma/adapter-pg. PrismaService imports PrismaPg at module
// load, but unit tests never instantiate PrismaService (they inject mocks), so a
// no-op class is enough and keeps the test runtime independent of pg.
class PrismaPg {
  constructor() {}
}
module.exports = { PrismaPg };
