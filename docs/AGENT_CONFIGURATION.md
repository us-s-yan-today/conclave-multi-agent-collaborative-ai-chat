# Agent Configuration Guide - 个人配置模式

## 概述

该系统现已升级为**个人 Agent 配置模式**，每个 Agent 都可以独立配置其 API 提供商、基础 URL、API 密钥和端点。这提供了最大的灵活性，允许用户在同一个系统中混合使用不同的 AI 提供商。

## 新架构特点

- **个人配置**: 每个 Agent 都有独立的 API 配置
- **多提供商支持**: 同时支持 OpenAI、Gemini、Anthropic 等
- **UI 集成**: 在 Agent 编辑界面中直接配置 API 设置
- **预设模板**: 提供常用 API 配置的快速预设

## Agent 配置结构

每个 Agent 现在包含一个 `apiConfig` 字段：

```typescript
interface Agent {
  id: string;
  name: string;
  model: string;
  apiConfig: {
    type: 'openai' | 'gemini' | 'anthropic';
    baseURL: string;
    apiKey: string;
    endpoint?: string; // 可选的自定义端点路径
  };
  // ... 其他字段
}
```

## 配置示例

### Gemini Agent
```typescript
{
  name: 'Research Assistant',
  model: 'gemini-2.5-pro',
  apiConfig: {
    type: 'gemini',
    baseURL: 'https://generativelanguage.googleapis.com',
    apiKey: 'your-gemini-api-key',
    endpoint: '/v1/models/{model}:generateContent'
  }
}
```

### OpenAI Agent
```typescript
{
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

### 通过 Cloudflare AI Gateway
```typescript
{
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

## UI 配置界面

在 Agent 编辑界面中，你可以：

1. **开启自定义 API 配置**: 通过切换开关启用 API 配置编辑
2. **使用预设模板**: 快速选择 OpenAI、Gemini 或 Cloudflare Gateway 配置
3. **自定义配置**: 手动输入提供商类型、基础 URL、API 密钥和端点

### 预设模板

- **OpenAI 官方**: 直接连接 OpenAI API
- **Gemini 官方**: 直接连接 Google AI Studio
- **Cloudflare Gateway**: 通过 Cloudflare AI Gateway 使用 OpenAI

## 环境变量（已移除全局依赖）

旧的全局环境变量配置不再需要，因为每个 Agent 都有自己的 API 配置。但如果你想保持向后兼容性，可以保留 `wrangler.jsonc` 中的配置作为默认值。

## 架构优势

1. **完全自主控制**: 每个 Agent 可以使用不同的提供商和配置
2. **无全局依赖**: 不需要在服务器端配置全局 API 密钥
3. **灵活混用**: 可以同时使用多个 AI 提供商
4. **用户友好**: 在 UI 中直接配置，无需修改代码
5. **安全隔离**: 每个 Agent 的 API 密钥独立管理

## 实现文件

### 后端提供商系统
- `worker/providers/base-provider.ts`: 提供商抽象接口
- `worker/providers/openai-provider.ts`: OpenAI 提供商实现
- `worker/providers/gemini-provider.ts`: Gemini 提供商实现
- `worker/providers/provider-factory.ts`: 提供商工厂类

### 前端配置
- `src/lib/agents.ts`: Agent 接口和默认配置
- `src/components/AgentConfigDrawer.tsx`: UI 配置界面

### 集成
- `worker/chat.ts`: 更新的聊天处理器
- `worker/agent.ts`: 更新的 Agent 类

## 迁移指南

如果你有现有的 Agent 配置：

1. 每个 Agent 都需要添加 `apiConfig` 字段
2. 在 UI 中编辑每个 Agent，配置其 API 设置
3. 移除对全局环境变量的依赖（可选）

## 注意事项

- **API 密钥安全**: 确保 API 密钥在客户端安全存储
- **费用监控**: 不同提供商有不同的计费方式
- **速率限制**: 各提供商的速率限制不同
- **模型兼容性**: 确保模型名称与提供商匹配