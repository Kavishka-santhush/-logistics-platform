const config = require('../config');
const prisma = require('./prisma');
const logger = require('../utils/logger.util');

/**
 * OpenRouter chat-completion client.
 * Returns { content, parsed (if JSON requested), usage, cost }.
 * Logs every call to AiUsageLog for platform AI-spend observability.
 */
async function chat(
  { messages, model = config.openrouter.model, temperature = 0.2, json = false, maxTokens = 2048 },
  meta = {}
) {
  const started = Date.now();
  const headers = {
    'Authorization': `Bearer ${config.openrouter.apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': config.clientUrl,
    'X-Title': 'Logistics Platform',
  };

  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  };

  try {
    const res = await fetch(`${config.openrouter.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    const usage = data.usage || {};

    let parsed = null;
    if (json) {
      try {
        parsed = JSON.parse(content);
      } catch (_) {
        parsed = null;
      }
    }

    await logUsage({
      organizationId: meta.organizationId,
      userId: meta.userId,
      feature: meta.feature || 'general',
      model,
      usage,
      latencyMs: Date.now() - started,
      success: true,
    });

    return { content, parsed, usage, model };
  } catch (err) {
    logger.error('OpenRouter call failed', err);
    await logUsage({
      organizationId: meta.organizationId,
      userId: meta.userId,
      feature: meta.feature || 'general',
      model,
      usage: {},
      latencyMs: Date.now() - started,
      success: false,
      errorMessage: err.message,
    });
    throw err;
  }
}

async function logUsage({ organizationId, userId, feature, model, usage, latencyMs, success, errorMessage }) {
  try {
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    await prisma.aiUsageLog.create({
      data: {
        organizationId: organizationId || null,
        userId: userId || null,
        feature,
        model,
        promptTokens,
        completionTokens,
        totalTokens: usage.total_tokens || promptTokens + completionTokens,
        estimatedCostUsd: Number(usage.cost || 0),
        latencyMs,
        success,
        errorMessage: errorMessage || null,
      },
    });
  } catch (e) {
    logger.warn('ai usage log failed', e.message);
  }
}

module.exports = { chat };
