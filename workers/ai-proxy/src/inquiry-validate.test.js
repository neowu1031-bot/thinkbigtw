// 官網詢問表單驗證：保留給系統產生的標記不得由表單送入（AEGIS D4-20261113 G1）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInquiry } from './thinkbig.js';
import { GROUP_SOURCE } from './line-group.js';

const base = () => ({ id: '0f8fad5b-d9cb-469f-a165-70867728950e', consent: true, name: '測試者', organization: '', need: '想了解企業方案', scale: '20 人', contactMethod: 'email', contact: 'test@example.com' });

test('一般表單照常通過', () => {
  assert.equal(validateInquiry(base()).scale, '20 人');
  assert.equal(validateInquiry({ ...base(), scale: 'source=quick-form' }).scale, 'source=quick-form');
  assert.equal(validateInquiry({ ...base(), name: 'LINE 用戶小王' }).name, 'LINE 用戶小王');
});

test('拒收規模＝line-group-accountant（含全形、大小寫、空白、夾帶變體）', () => {
  assert.equal(GROUP_SOURCE, 'line-group-accountant');
  for (const scale of ['line-group-accountant', 'LINE-GROUP-ACCOUNTANT', ' line-group-accountant ', 'ｌｉｎｅ－ｇｒｏｕｐ－ａｃｃｏｕｎｔａｎｔ', 'line - group - accountant', '20人 line-group-accountant'])
    assert.throws(() => validateInquiry({ ...base(), scale }), /invalid_inquiry/, scale);
  assert.throws(() => validateInquiry({ ...base(), organization: 'source=line-group-accountant' }), /invalid_inquiry/);
});

test('拒收稱呼＝LINE OA 系統（含全形與空白變體）', () => {
  for (const name of ['LINE OA 系統', 'line oa 系統', 'LINEOA系統', 'ＬＩＮＥ　ＯＡ　系統'])
    assert.throws(() => validateInquiry({ ...base(), name }), /invalid_inquiry/, name);
});

test('既有規則不變：規模＝預約評估仍拒收', () => {
  assert.throws(() => validateInquiry({ ...base(), scale: '預約評估' }), /invalid_inquiry/);
});
