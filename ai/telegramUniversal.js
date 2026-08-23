function buildOpenAIImageRequest({ hasSource, model, size, quality, background, outputFormat }) {
  return {
    tools: [{
      type: 'image_generation',
      action: hasSource ? 'edit' : 'generate',
      model,
      size,
      quality,
      background,
      output_format: outputFormat,
    }],
    toolChoice: { type: 'image_generation' },
  };
}

module.exports = { buildOpenAIImageRequest };
