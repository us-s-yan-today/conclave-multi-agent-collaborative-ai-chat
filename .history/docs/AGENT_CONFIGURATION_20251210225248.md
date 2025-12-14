# Agent Configuration Guide

## Overview

This document explains how to configure agents with different AI providers (OpenAI, Gemini, etc.) in the multi-agent chat system.

## Configuration Architecture

The system now supports multiple AI providers through a provider abstraction layer:

- **Provider Factory**: Automatically determines the correct provider based on model name
- **Multiple Providers**: OpenAI and Gemini providers with unified interface
- **Environment Configuration**: Separate base URLs and API keys for each provider

## Environment Variables

Configure the following environment variables in `wrangler.jsonc`:

```json
{
  "vars": {
    "CF_AI_BASE_URL": "https://gateway.ai.cloudflare.com/v1/YOUR_ACCOUNT_ID/YOUR_GATEWAY_ID/openai",
    "CF_AI_API_KEY": "your-cloudflare-api-key",
    "GEMINI_BASE_URL": "https://generativelanguage.googleapis.com",
    "GEMINI_API_KEY": "your-gemini-api-key"
  }
}
```

### OpenAI Configuration
- **CF_AI_BASE_URL**: OpenAI API endpoint (or Cloudflare AI Gateway)
- **CF_AI_API_KEY**: Your OpenAI API key or Cloudflare API key

### Gemini Configuration  
- **GEMINI_BASE_URL**: Google AI Studio base URL
- **GEMINI_API_KEY**: Your Google AI Studio API key

## Agent Model Configuration

Agents are configured in `src/lib/agents.ts`. The model name determines which provider is used:

### Gemini Models
```typescript
model: 'google-ai-studio/gemini-2.5-flash'
model: 'google-ai-studio/gemini-2.5-pro'
```

### OpenAI Models
```typescript
model: 'gpt-4'
model: 'gpt-3.5-turbo'
```

## Provider Selection Rules

The system automatically selects the provider based on the model name:

1. **Gemini Provider**: Models starting with `google-ai-studio/` or `gemini`
2. **OpenAI Provider**: All other models

## Example Agent Configuration

```typescript
{
  id: 'agent-researcher',
  name: 'Researcher',
  model: 'google-ai-studio/gemini-2.5-pro', // Uses Gemini provider
  // ... other config
}
```

## Benefits of This Architecture

1. **API Consistency**: No need to change interface formats when switching providers
2. **Mixed Providers**: Different agents can use different providers simultaneously  
3. **Easy Extension**: Add new providers by implementing the `AIProvider` interface
4. **Automatic Routing**: Provider selection is automatic based on model name

## Migration from Single Provider

If migrating from the old single-provider system:

1. Update environment variables in `wrangler.jsonc`
2. Set your Gemini API credentials
3. Agent model names will automatically route to the correct provider
4. No changes needed to agent configurations unless changing models

## Adding New Providers

To add a new provider (e.g., Anthropic):

1. Create a new provider class implementing `AIProvider`
2. Add provider type to `ProviderConfig`
3. Update `ProviderFactory` to handle the new provider
4. Add environment variables for the new provider

## Troubleshooting

- **Wrong Provider**: Check model name format matches provider selection rules
- **API Errors**: Verify API keys and base URLs are correct
- **Missing Models**: Ensure the model is supported by the selected provider