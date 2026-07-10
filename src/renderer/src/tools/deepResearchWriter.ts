export const startDeepResearchWriter = async (query: string, mode: 'normal' | 'high', fileName?: string): Promise<string> => {
  try {
    // 1. Dispatch custom event to open the UI panel immediately
    window.dispatchEvent(new CustomEvent('deep-research-writer-start', { detail: { query, mode, fileName } }))

    // 2. Fetch required API keys
    const groqKey = localStorage.getItem('iris_groq_api_key') || ''
    const geminiKey = localStorage.getItem('iris_custom_api_key') || ''
    const tavilyKey = localStorage.getItem('iris_tailvy_api_key') || ''

    if (!groqKey) {
      return `❌ System Error: Groq API Key is missing. The user must provide it in settings.`
    }
    if (mode === 'high' && (!geminiKey || !tavilyKey)) {
      return `❌ System Error: High Deep Research requires both Gemini and Tavily API Keys. Please provide them in settings.`
    }

    // 3. Invoke backend stream logic
    const result = await window.electron.ipcRenderer.invoke('execute-deep-research-writer', {
      query,
      mode,
      fileName,
      groqKey,
      geminiKey,
      tavilyKey
    })

    if (result.success) {
      return `✅ Successfully completed and streamed ${mode} deep research paragraph to the user. The document will be saved automatically to this exact path: "${result.targetPath}". (Wait for user to confirm it is saved before attempting to open it).`
    } else {
      return `❌ Research failed: ${result.error}`
    }
  } catch (error) {
    return `❌ System failure starting Deep Research Writer: ${String(error)}`
  }
}
