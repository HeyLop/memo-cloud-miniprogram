# v2 数据库迁移记录

> 应用：`wbapp_0CBamvxrwaqn3mYKCHQrVQ` · 执行日期：2026-11-25
> 对应计划任务 4。所有语句幂等，可重复执行。

## 已执行的迁移（按顺序）

1. `ALTER TABLE notes ADD COLUMN IF NOT EXISTS zone TEXT DEFAULT 'work'`
2. `ALTER TABLE notes ADD COLUMN IF NOT EXISTS parse_meta JSONB`
3. `CREATE TABLE IF NOT EXISTS user_settings (owner_id TEXT PRIMARY KEY DEFAULT auth.uid(), work_hours JSONB, reminder_lead_time INT DEFAULT 1440)`
4. `ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY`
5. `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_settings TO authenticated, anon`
6. `CREATE POLICY user_settings_own ON user_settings FOR ALL TO authenticated, anon USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())`

## 验证结果

- `notes` 表新增列：`zone`(text, default work) ✓、`parse_meta`(jsonb) ✓
- `user_settings` 表：三列齐全 ✓，`user_settings_own` 策略在 ✓
- 写入读回自检：显式 `owner_id='v2_selftest'` 写入 zone=life / parse_meta={"confidence":0.95}，读回一致 ✓，已清理 ✓
- 原有 notes 四条 RLS 策略未动 ✓

## 说明

- 沿用 v1 的 WorkBuddy 云 + RLS 方案（D10），不换微信云开发。
- `category` 旧列保留不动（v1 数据兼容），v2 用新 `zone` 列（work/life 两分区）。
- `user_settings` 的时段配置供二期推送用，本版不读写它。
