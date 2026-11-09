// 11/9：英文訪客要用英文回答（Telegram 客服實測：問「Can you speak English?」被回只能講中文）。
// 只驗證規則有送到模型的兩條路徑；模型實答在部署後用 curl 抽測。
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectKnowledge, selectKnowledgePrimary, SCOPE_RULE, filterReply } from './thinkbig.js';

const RULE = '訪客用英文提問就用英文答，其餘只用台灣繁體中文，嚴禁簡體字。';
const cases = [[{ role: 'user', content: 'Can you speak English?' }], [{ role: 'user', content: '你們有哪些方案？' }]];

test('KB 語言規則：英文跟著訪客、其餘繁中，兩條路徑都帶到', () => {
  for (const msgs of cases) {
    assert.ok(selectKnowledge(msgs).text.includes(RULE), 'fallback / LINE path');
    assert.ok(selectKnowledgePrimary(msgs).text.includes(RULE), 'website primary path');
  }
});

test('KB 語言規則：不再有「只用台灣繁體中文」的無條件版本', () => {
  const text = selectKnowledgePrimary(cases[0]).text + SCOPE_RULE;
  assert.equal(text.split('只用台灣繁體中文').length - 1, 1);
  assert.ok(!/(?<!其餘)只用台灣繁體中文/.test(text));
});

test('KB 身分：官網名稱不變', () => {
  assert.ok(selectKnowledgePrimary(cases[1]).text.includes('你是「Think BIG AI 顧問」'));
});

// AEGIS D4 C1（11/9）：英文回覆也不能假裝已送出／已預約／已收件。
const EN_GUARD = /^I can't send, book or receive anything here\. If you'd like a consultant to contact you, tap 「整理諮詢摘要」/;
test('filterReply 英文假送出／假預約：攔下並回英文固定句', () => {
  const claims = [
    "Great, I've submitted your request to our team.",
    'I have forwarded your inquiry to a consultant.',
    'We have received your details and will be in touch.',
    'Your consultation has been booked for Monday.',
    'Your appointment is confirmed.',
    "You're all booked for a 30-minute assessment!",
    'A consultant will contact you within one working day.',
    "Our team will reach out to you shortly.",
    'I\u2019ve sent your information to Think BIG.',
  ];
  for (const r of claims) assert.match(filterReply(r), EN_GUARD, r);
  assert.match(filterReply("I've booked your demo.", 'experience'), /^I can only help you draft here\./);
  assert.match(filterReply('Your booking is confirmed.', 'retail'), /^This demo doesn't send or book anything/);
});

test('filterReply 英文正常說明：不誤攔', () => {
  const ok = [
    'Once you submit the inquiry summary, a consultant will contact you within one working day.',
    'If you fill in the self-assessment, our team will email you within one working day.',
    "I can't submit or book anything for you. You can book a free 30-minute assessment at https://thinkbigtw.com/enterprise/start/",
    "I haven't sent anything. Tap the inquiry summary button when you are ready.",
    'Think BIG helps companies set up AI agents that answer from their own documents.',
    'You can send us your question on LINE: https://lin.ee/n5KW430',
  ];
  for (const r of ok) assert.equal(filterReply(r), r, r);
});

test('filterReply 中文行為不變', () => {
  assert.equal(filterReply('好的，已幫您送出諮詢！'), '如需顧問聯繫，請點「整理諮詢摘要」，核對需求及聯絡方式後再確認送出。是否收件以介面顯示的送出結果為準。');
  assert.equal(filterReply('顧問會主動聯繫您喔'), '如需顧問聯繫，請點「整理諮詢摘要」，核對需求及聯絡方式後再確認送出。是否收件以介面顯示的送出結果為準。');
  assert.equal(filterReply('已幫你預約好了', 'retail'), '這個體驗不會替你送出或預約任何事情。若想討論正式導入，請按頁面下方「討論我的門市需求」。');
  assert.equal(filterReply('填完摘要後，1 個工作日內由真人聯繫。'), '填完摘要後，1 個工作日內由真人聯繫。');
});
