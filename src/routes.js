import React from 'react'

const Home = React.lazy(() => import('./views/home/Home'))
const Caches = React.lazy(() => import('./views/Caches'))
const Textures = React.lazy(() => import('./views/Textures'))
const InventoryHelper = React.lazy(() => import('./views/InventoryHelper'))
const MapView = React.lazy(() => import('./views/MapViewer'))

const Items = React.lazy(() => import('./views/Items'))
const Colors = React.lazy(() => import('./views/Colors'))
const Sprites = React.lazy(() => import('./views/Sprites'))
const Models = React.lazy(() => import('./views/Models'))

const routes = [
  { path: '/', exact: true, name: 'Home' },
  { path: '/home', name: 'Home', element: Home },
  { path: '/caches', name: 'Caches', element: Caches },
  { path: '/textures', name: 'Textures', element: Textures },
  { path: '/items', name: 'Textures', element: Items },
  { path: '/colors', name: 'Colors', element: Colors },
  { path: '/inventoryHelper', name: 'Inventory Helper', element: InventoryHelper },
  { path: '/MapViewer', name: 'Map View', element: MapView },
  { path: '/sprites', name: 'Sprites', element: Sprites },
  { path: '/models', name: 'Sprites', element: Models }
]

export default routes
