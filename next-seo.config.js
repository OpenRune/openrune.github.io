export default {
    title: 'Home',
    titleTemplate: 'osrsdb',

    description: 'Find Ruenscape Cache Data.',
    canonical: " osrsdb.dev",

    openGraph: {
      type: 'website',
      locale: 'en_GB',
      url: ' osrsdb.dev',
      description: 'Find the best items to alch in OSRS. Old School RuneScape High Alchemy Calculator.',
      site_name: 'osrsdb',
      title: 'osrsdb',
      images: [
        {
          url: 'https://i.imgur.com/V9ScNJG.png',
          width: 800,
          height: 600,
          alt: 'osrsdb',
        }
      ]
    },
    additionalMetaTags: [
      {
        property: 'dc:creator',
        content: 'Mark'
      }, 
      {
        name: 'application-name',
        content: 'osrsdb'
      },
      {
        name: 'language',
        content: 'English'
      },
      {
        httpEquiv: 'x-ua-compatible',
        content: 'IE=edge; chrome=1'
      },
      {
        name: 'keywords',
        content: ["osrs", "osrsdb", "osrsdbemy", "osrs alchemy" , "osrs magic guide"]
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, shrink-to-fit=no'
      }
    ],
    images: [
      {
        url: 'https://i.imgur.com/V9ScNJG.png',
        width: 800,
        height: 600,
        alt: 'osrsdb',
      },
    ],
    additionalLinkTags : [
      {
        rel: 'apple-touch-icon',
        href: '/public/apple-touch-icon.png',
        sizes: '180x180'
      },
      {
        rel: 'android-chrome-icon',
        href: '/public/android-chrome-192x192.png',
        sizes: '192x192'
      },
      {
        rel: 'android-chrome-icon',
        href: '/public/android-chrome-256x256',
        sizes: '256x256'
      }
    ]
  }