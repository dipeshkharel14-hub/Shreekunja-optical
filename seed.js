/**
 * seed/seed.js
 *
 * Creates the exactly-three admin accounts (spec sections 16, 49).
 * Deliberately NOT exposed as an API route — this only runs via
 * `npm run seed` on a machine with direct database access.
 *
 * Safety rules enforced here:
 *   - Refuses to run at all unless ALLOW_ADMIN_SEED=true is set.
 *   - Refuses to create a 4th admin account under any circumstance
 *     (models/Admin.js enforces MAX_ADMINS = 3 independently too).
 *   - Refuses to run with missing or weak passwords.
 *   - Skips (does not overwrite) any admin whose email already exists,
 *     so re-running the seed is always safe.
 */

const { pool } = require('../config/database');
const AdminModel = require('../models/Admin');
const { hashPassword, isPasswordStrongEnough } = require('../utils/security');
const config = require('../config/env');

async function main() {
  if (!config.adminSeed.allowed) {
    console.error('\n❌ Refusing to seed: set ALLOW_ADMIN_SEED=true in .env to run this intentionally.\n');
    process.exitCode = 1;
    return;
  }

  const existingCount = await AdminModel.count();

  if (existingCount >= AdminModel.MAX_ADMINS) {
    console.log(`ℹ️  ${existingCount} admin account(s) already exist (max is ${AdminModel.MAX_ADMINS}). Nothing to do.`);
    return;
  }

  for (const admin of config.adminSeed.admins) {
    if (!admin.email) {
      console.error(`\n❌ Missing email for "${admin.name}". Set ADMIN_${admin.role === 'SUPER_ADMIN' ? 1 : '2/3'}_EMAIL in .env.\n`);
      process.exitCode = 1;
      return;
    }

    if (!isPasswordStrongEnough(admin.password)) {
      console.error(`\n❌ Missing or weak password for "${admin.name}" (need 10+ characters). Set it in .env before seeding.\n`);
      process.exitCode = 1;
      return;
    }

    const existing = await AdminModel.findByEmail(admin.email);

    if (existing) {
      console.log(`⏭️  Skipping ${admin.name} — an admin with email ${admin.email} already exists.`);
      continue;
    }

    const passwordHash = await hashPassword(admin.password);

    try {
      const created = await AdminModel.createAdmin({
        name: admin.name,
        email: admin.email,
        passwordHash,
        role: admin.role
      });
      console.log(`✅ Created admin: ${created.name} <${created.email}> [${created.role}]`);
    } catch (err) {
      console.error(`❌ Failed to create ${admin.name}: ${err.message}`);
      process.exitCode = 1;
      return;
    }
  }

  console.log('\n✅ Seed complete. Admin passwords are stored only as bcrypt hashes.');
  console.log('   Remove ADMIN_*_PASSWORD values from .env now that seeding is done.\n');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
