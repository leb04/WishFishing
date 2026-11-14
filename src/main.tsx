import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const root = document.getElementById('root')

if (!root) throw new Error('The application root element is missing.')

const applicationRoot = createRoot(root)

async function renderApplication() {
  const params = new URLSearchParams(window.location.search)
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
  if (import.meta.env.DEV && params.get('showcase') === 'kenney') {
    const { default: AssetShowcase } = await import('./dev/AssetShowcase')
    applicationRoot.render(<StrictMode><AssetShowcase /></StrictMode>)
    return
  }
  const developerMode = localHost && params.get('dev') === 'cinematic'
  applicationRoot.render(<StrictMode><App developerMode={developerMode} /></StrictMode>)
}

void renderApplication()
