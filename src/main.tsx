import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const root = document.getElementById('root')

if (!root) throw new Error('The application root element is missing.')

const applicationRoot = createRoot(root)

async function renderApplication() {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('showcase') === 'kenney') {
    const { default: AssetShowcase } = await import('./dev/AssetShowcase')
    applicationRoot.render(<StrictMode><AssetShowcase /></StrictMode>)
    return
  }
  applicationRoot.render(<StrictMode><App /></StrictMode>)
}

void renderApplication()
