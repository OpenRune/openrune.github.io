# Update 1.0 - The Rebuild

Welcome to version 1.0! This is a big one - we've rebuilt a lot of stuff and added some cool new features.

## ✨ Major Features

- **Map & Object View**: Added a new map viewer and improved object viewing capabilities throughout the site
- **Sprite & Texture Downloads**: You can now download sprites and textures directly from the site. The download manager shows real-time progress and handles everything automatically.
- **Full Width Content Setting**: New setting to toggle full-width content mode for a better viewing experience

### API Documentation

We've added a complete API documentation page that makes it way easier to explore and test the API:

- **Interactive URL Builder**: Build API URLs with all the parameters you need, right in your browser
- **Test Queries**: Hit the run button to test any endpoint and see the results in a modal
- **Live Examples**: See formatted JSON responses, image previews, and handle errors gracefully

### Visual Improvements

- **Custom Scrollbars**: Replaced the default scrollbars with custom ones that match the site's design
- **Smooth Animations**: 
  - Collapsible sections now animate smoothly when opening/closing
  - Chevrons rotate nicely
  - Fade effects for better transitions
  - Overall smoother feel throughout the site

- **Better Layout**: Cleaned up spacing and padding everywhere. Things just feel more consistent now.
- **Theme Support**: Dark/light themes work better with smoother transitions between them

### Performance

Fixed a bunch of performance issues:

- **No More Input Lag**: Optimized how inputs work, so typing feels instant again
- **Faster Renders**: Memoized components to prevent unnecessary re-renders
- **Smarter URL Building**: URLs are cached and built more efficiently
- **Lazy Loading**: Components only load when you actually need them

### Better Interactions

- **Visual Feedback**: Hover states, active states, and loading indicators are clearer
- **Tooltips**: Added helpful tooltips where they make sense
- **Context Menus**: Right-click on sprites and textures for quick actions
- **Keyboard Support**: Better keyboard navigation throughout

## 🛠️ Backend Improvements

The backend got some love too:

- **Better Caching**: Improved caching means faster response times
- **Cleaner API**: Reorganized endpoints to be more consistent
- **SSE Support**: Real-time updates using Server-Sent Events for live progress tracking
- **Error Handling**: More helpful error messages when things go wrong

## 🐛 Bug Fixes

- Fixed input lag that was making the API docs page feel sluggish
- Improved error handling across the board
- Fixed layout shifts that were causing content to jump around
- General performance improvements

---

Thanks for using OpenRune! Let us know if you notice any issues or have suggestions.
