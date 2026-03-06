import { describe, expect, it } from 'vitest';

import { getDefaultPreferences } from '../../core/preferences';
import { renderSettingsMarkup } from '../settingsPanel';

describe('settings methodology references', () => {
  it('renders the master reference list inside settings instead of the main console', () => {
    const markup = renderSettingsMarkup(getDefaultPreferences(), 'methodology');

    expect(markup).toContain('Methodology');
    expect(markup).toContain('Namazue Engine은 다음의 학술 모델과 공공기관 레퍼런스를 기반으로 설계되었습니다.');
    expect(markup).toContain('Section 11. Master Reference List');
    expect(markup).toContain('Last audited: 2026-03-07');
    expect(markup).toContain('Si & Midorikawa');
    expect(markup).toContain('Wells & Coppersmith');
    expect(markup).toContain('気象庁');
    expect(markup).toContain('総務省統計局');
  });
});
