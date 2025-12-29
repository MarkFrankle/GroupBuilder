import React from "react"
import ReactDOM from "react-dom/client"
import "./styles/index.css" // Make sure this imports all your styles
import App from "./App"
import ErrorBoundary from "./components/ErrorBoundary"
import reportWebVitals from './utils/reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement)
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
