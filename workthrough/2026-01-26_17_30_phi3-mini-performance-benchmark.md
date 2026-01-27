# Phi3:mini Model Performance Benchmark Report

## Overview
Performance evaluation of the Phi3:mini model running in Docker (Ollama) for the AI-assisted worklog auto-input feature.

## Model Specifications

| Attribute | Value |
|-----------|-------|
| Model Name | phi3:mini |
| Parameters | 3.8B |
| Quantization | Q4_0 |
| Model Size | 2.03 GB |
| Memory Usage | 3.77 GB / 7.8 GB (48%) |
| Runtime | Ollama (Docker) |
| Hardware | CPU-only (no GPU acceleration) |

## Performance Test Results

### Test Cases

| # | Test Description | Response Time | Tokens Generated | Speed |
|---|------------------|---------------|------------------|-------|
| 1 | Simple English prompt ("What is 2+2?") | **59.4 sec** | 153 | 2.6 tok/s |
| 2 | Simple Korean prompt ("안녕하세요") | **39.5 sec** | 104 | 2.6 tok/s |
| 3 | JSON parsing (simple worklog) | **16.0 sec** | 47 | 2.9 tok/s |
| 4 | JSON parsing (complex worklog) | **31.9 sec** | 82 | 2.6 tok/s |
| 5 | Number counting (1-5) | **12.8 sec** | 20 | 2.0 tok/s |

### Key Metrics

- **Average Token Generation Speed**: ~2-3 tokens/second
- **Prompt Evaluation**: ~2.5-3 seconds for 15 tokens
- **Model Load Time**: ~34ms (already loaded in memory)

## Analysis

### Current Performance Issues

1. **Extremely Slow Response**: Even simple queries take 10-60 seconds
2. **Worklog Parsing Latency**: 30+ seconds for typical worklog entries
3. **Timeout Risk**: Complex inputs may exceed the 180-second timeout
4. **Poor UX**: Users must wait too long for AI analysis results

### Root Cause

The model is running on **CPU-only** without GPU acceleration:
- Docker container has no GPU passthrough configured
- Ollama defaults to CPU inference when no GPU is available
- Q4_0 quantization helps reduce memory but doesn't improve CPU speed

## Recommendations

### Option 1: Enable GPU Acceleration (Recommended)

| GPU Type | Expected Speed | Configuration |
|----------|----------------|---------------|
| NVIDIA GPU | 30-100 tok/s | Add `--gpus all` to Docker |
| Apple Silicon (MPS) | 20-50 tok/s | Run Ollama natively on Mac |
| AMD GPU (ROCm) | 20-60 tok/s | Use ROCm-enabled Ollama |

**Docker GPU Configuration:**
```yaml
ollama:
  image: ollama/ollama:latest
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

### Option 2: Use Smaller/Faster Models

| Model | Parameters | Expected Speed | Quality |
|-------|------------|----------------|---------|
| gemma:2b | 2B | 5-8 tok/s | Lower |
| phi3:mini (current) | 3.8B | 2-3 tok/s | Medium |
| llama3.2:1b | 1B | 8-12 tok/s | Lower |
| qwen2:1.5b | 1.5B | 6-10 tok/s | Medium |

### Option 3: Cloud API Integration

| Provider | Expected Speed | Cost |
|----------|----------------|------|
| OpenAI GPT-4o-mini | 50-100 tok/s | ~$0.15/1M tokens |
| Anthropic Claude Haiku | 50-80 tok/s | ~$0.25/1M tokens |
| Google Gemini Flash | 60-100 tok/s | ~$0.075/1M tokens |

### Option 4: Hybrid Approach

1. Use local Ollama for simple/short inputs
2. Fall back to cloud API for complex inputs or timeouts
3. Cache common prompt patterns

## Conclusion

The current CPU-only Phi3:mini setup is **not suitable for production use** due to:
- Response times of 15-60 seconds
- Risk of timeouts on complex inputs
- Poor user experience

**Recommended Action**: Enable GPU acceleration or switch to a cloud API for acceptable response times (< 5 seconds).

## Test Environment

- **OS**: macOS Darwin 25.2.0
- **Docker**: Ollama container (edwards-ollama)
- **Date**: 2026-01-26
- **Ollama Version**: Latest
