// Purpose: Playwright test extension exporting a fixture with AxeBuilder preconfigured for WCAG 2.2 AA.
// Rules: standards/testing.md, standards/ui.md. Zero violations on wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa.
import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export const WCAG_22_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;

type AxeFixture = {
  makeAxeBuilder: () => AxeBuilder;
};

export const test = base.extend<AxeFixture>({
  makeAxeBuilder: async ({ page }, provide) => {
    const makeAxeBuilder = () => new AxeBuilder({ page }).withTags([...WCAG_22_AA_TAGS]);
    await provide(makeAxeBuilder);
  },
});

export { expect };
