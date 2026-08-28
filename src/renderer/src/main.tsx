import React from 'react'
import ReactDOM from 'react-dom/client'
import '@xyflow/react/dist/style.css'
import 'katex/dist/katex.min.css'
import './styles.css'
import { App } from './App'
import { PrompterView } from './components/PrompterView'

const isPrompter = window.location.hash === '#/prompter'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isPrompter ? <PrompterView /> : <App />}</React.StrictMode>
)
