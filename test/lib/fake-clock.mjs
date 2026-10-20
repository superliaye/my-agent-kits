// Preload for `node --import`: pins `new Date()` and `Date.now()` to FAKE_NOW (an ISO timestamp),
// so runtime tests can schedule across days without a test-only API in the script under test.
const fixed = Date.parse(process.env.FAKE_NOW ?? '');
if (Number.isNaN(fixed)) throw new Error('fake-clock: FAKE_NOW must be an ISO timestamp');

const RealDate = Date;
class FakeDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(fixed);
    else super(...args);
  }

  static now() {
    return fixed;
  }
}
globalThis.Date = FakeDate;
