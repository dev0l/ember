import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PRIVACY_POLICY_URL,
  PRIVACY_POLICY_CONTACT_EMAIL,
  PRIVACY_POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_APP_VERSION,
  PRIVACY_POLICY_PACKAGE_ID,
  PRIVACY_POLICY_DEVELOPER,
  PRIVACY_POLICY_HIGHLIGHTS,
  PRIVACY_POLICY_SECTIONS,
} from '../privacy-policy.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

describe('Privacy Policy Contract & In-App Integration', () => {
  it('defines canonical URL, developer identity, package ID, and contact email', () => {
    assert.equal(PRIVACY_POLICY_URL, 'https://www.dev0l.com/ember/privacy/');
    assert.equal(PRIVACY_POLICY_CONTACT_EMAIL, 'marcus.mobark@gmail.com');
    assert.equal(PRIVACY_POLICY_PACKAGE_ID, 'com.dev0l.ember');
    assert.equal(PRIVACY_POLICY_DEVELOPER, 'dev0l');
    assert.equal(PRIVACY_POLICY_APP_VERSION, '0.1.0');
    assert.ok(PRIVACY_POLICY_EFFECTIVE_DATE.length > 0);
  });

  it('provides Local-First summary highlights and all 9 comprehensive policy sections', () => {
    assert.equal(PRIVACY_POLICY_HIGHLIGHTS.length, 3);
    assert.equal(PRIVACY_POLICY_SECTIONS.length, 9);

    const ids = PRIVACY_POLICY_SECTIONS.map((s) => s.id);
    assert.deepEqual(ids, [
      'overview',
      'on-device-data',
      'no-collection',
      'permissions',
      'retention-deletion',
      'system-backup',
      'children',
      'updates',
      'contact',
    ]);

    const contactSection = PRIVACY_POLICY_SECTIONS.find((s) => s.id === 'contact');
    assert.ok(contactSection);
    assert.ok(contactSection.paragraphs.includes(PRIVACY_POLICY_CONTACT_EMAIL));
  });

  it('wires PrivacyPolicyModal and the PRIVACY POLICY footer into CollectionsScreen (both empty and populated states)', () => {
    const collectionsSrc = fs.readFileSync(
      path.join(ROOT_DIR, 'src/app/(main)/collections/index.tsx'),
      'utf8',
    );
    const modalSrc = fs.readFileSync(
      path.join(ROOT_DIR, 'src/components/privacy/PrivacyPolicyModal.tsx'),
      'utf8',
    );

    assert.match(collectionsSrc, /PrivacyPolicyModal/);
    assert.match(collectionsSrc, /PRIVACY POLICY/);
    assert.match(collectionsSrc, /setShowPrivacyPolicy\(true\)/);

    assert.match(modalSrc, /Linking\.openURL\(PRIVACY_POLICY_URL\)/);
    assert.match(modalSrc, /View Online Policy ↗/);
    assert.match(modalSrc, /PRIVACY_POLICY_CONTACT_EMAIL/);
  });
});
