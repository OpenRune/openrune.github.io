import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import 'core-js'

import App from './App'
import store from './store'
import { AlertProviderWithDisplay } from "src/components/AlertProviderWithDisplay";
import {ModalProvider} from "src/api/ModalProvider";
import {ServerProvider} from "src/api/apiService";

createRoot(document.getElementById('root')).render(

  <ServerProvider>
    <AlertProviderWithDisplay>
      <Provider store={store}>
        <ModalProvider>
          <App />
        </ModalProvider>
      </Provider>
    </AlertProviderWithDisplay>
  </ServerProvider>
)
