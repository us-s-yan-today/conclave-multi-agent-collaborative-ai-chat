# 个人 Agent 配置示例

## 概述

现在每个 Agent 都可以单独配置其 API 提供商、基础 URL、API 密钥和端点。这为用户提供了最大的灵活性，允许混合使用不同的 AI 提供商。

## Agent 配置结构

每个 Agent 现在包含一个 `apiConfig` 字段：

```typescript
interface Agent {
  // ... 其他字段
  apiConfig: {
    type: 'openai' | 'gemini' | 'anthropic';
    baseURL: string;
    apiKey: string;
    endpoint?: string; // 可选的自定义端点路径
  };
}
```

## 配置示例

### Gemini Agent 配置
```javascript
{
  id: 'agent-researcher',
  name: 'Researcher',
  model: 'gemini-2.5-pro',
  apiConfig: {
    type: 'gemini',
    baseURL: 'https://generativelanguage.googleapis.com',
    apiKey: 'your-gemini-api-key',
    endpoint: '/v1/models/{model}:generateContent'
  }
}
```

### OpenAI Agent 配置
```javascript
{
  id: 'agent-creative',
  name: 'Creative Writer',
  model: 'gpt-4',
  apiConfig: {
    type: 'openai',
    baseURL: 'https://api.openai.com/v1',
    apiKey: 'your-openai-api-key',
    endpoint: '/chat/completions'
  }
}
```

### 通过 Cloudflare AI Gateway 的 OpenAI
```javascript
{
  id: 'agent-analyst',
  name: 'Data Analyst',
  model: 'gpt-3.5-turbo',
  apiConfig: {
    type: 'openai',
    baseURL: 'https://gateway.ai.cloudflare.com/v1/YOUR_ACCOUNT_ID/YOUR_GATEWAY_ID/openai',
    apiKey: 'your-cloudflare-api-key',
    endpoint: '/chat/completions'
  }
}
```

### 自定义 Gemini 端点
```javascript
{
  id: 'agent-translator',
  name: 'Translator',
  model: 'gemini-1.5-pro',
  apiConfig: {
    type: 'gemini',
    baseURL: 'https://your-custom-gemini-proxy.com',
    apiKey: 'your-custom-api-key',
    endpoint: '/api/v2/generate'
  }
}
```

## UI 配置界面建议

在 Agent 编辑界面中，应该提供以下配置字段：

### 基础配置
- **提供商类型** (下拉选择)：OpenAI, Gemini, Anthropic
- **模型名称** (文本输入)：如 `gpt-4`, `gemini-2.5-pro`

### API 配置
- **基础 URL** (文本输入)：API 的基础地址
- **API 密钥** (密码输入)：API 访问密钥
- **端点路径** (文本输入，可选)：自定义端点路径

### 预设模板
提供常用的配置预设：

1. **OpenAI 官方**
   - baseURL: `https://api.openai.com/v1`
   - endpoint: `/chat/completions`

2. **Gemini 官方**
   - baseURL: `https://generativelanguage.googleapis.com`
   - endpoint: `/v1/models/{model}:generateContent`

3. **Cloudflare AI Gateway**
   - baseURL: `https://gateway.ai.cloudflare.com/v1/[账户ID]/[网关ID]/openai`
   - endpoint: `/chat/completions`

## 配置验证

建议在 UI 中添加配置验证功能：

```javascript
// 验证 API 配置是否有效
async function validateApiConfig(apiConfig) {
  try {
    // 发送测试请求
    const testMessage = "Hello";
    const response = await testProvider(apiConfig, testMessage);
    return { valid: true, message: "配置有效" };
  } catch (error) {
    return { valid: false, message: error.message };
  }
}
```

## 优势

1. **完全自主控制**：每个 agent 可以使用不同的提供商和配置
2. **灵活性**：支持官方 API、代理服务、自建端点等
3. **安全性**：API 密钥单独管理，不共享
4. **可扩展性**：易于添加新的 AI 提供商
5. **测试友好**：可以轻松切换不同的 API 配置进行测试

## 注意事项

1. **API 密钥安全**：确保 API 密钥在前端不会泄露，考虑使用环境变量或安全存储
2. **费用控制**：不同提供商有不同的计费方式，注意监控使用量
3. **速率限制**：各个提供商有不同的速率限制，需要合理配置
4. **模型兼容性**：确保选择的模型与提供商兼容