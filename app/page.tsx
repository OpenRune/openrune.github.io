'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  IconPackage,
  IconCube,
  IconUser,
  IconPhoto,
  IconTexture,
  IconKeyframes,
  IconKeyframe,
  IconStairs,
  IconPalette,
  IconChartBar,
  IconMap,
  IconCode,
  IconSettings,
  IconArrowRight,
  IconFileSettings,
  IconTools
} from '@tabler/icons-react';

export default function Home() {
  const gameEntities = [
    {
      title: 'Objects',
      description: 'Browse and search game objects',
      icon: <IconCube size={24} />,
      path: '/objects',
      color: 'text-blue-500'
    },
    {
      title: 'Items',
      description: 'Explore item configurations',
      icon: <IconPackage size={24} />,
      path: '/items',
      color: 'text-green-500'
    },
    {
      title: 'NPCs',
      description: 'View NPC data and configurations',
      icon: <IconUser size={24} />,
      path: '/npcs',
      color: 'text-purple-500'
    }
  ];

  const visualAssets = [
    {
      title: 'Sprites',
      description: 'Browse sprite images and data',
      icon: <IconPhoto size={24} />,
      path: '/sprites',
      color: 'text-orange-500'
    },
    {
      title: 'Textures',
      description: 'View texture images and data',
      icon: <IconTexture size={24} />,
      path: '/textures',
      color: 'text-pink-500'
    },
    {
      title: 'Sequences',
      description: 'Explore animation sequences',
      icon: <IconKeyframes size={24} />,
      path: '/sequences',
      color: 'text-cyan-500'
    },
    {
      title: 'Spot Animations',
      description: 'View spot animation data',
      icon: <IconKeyframe size={24} />,
      path: '/spotanims',
      color: 'text-yellow-500'
    },
    {
      title: 'Overlays & Underlays',
      description: 'Browse overlay and underlay data',
      icon: <IconStairs size={24} />,
      path: '/underlays-overlays',
      color: 'text-indigo-500'
    }
  ];

  const tools = [
    {
      title: 'Color Helper',
      description: 'Color conversion and manipulation tools',
      icon: <IconPalette size={24} />,
      path: '/colors',
      color: 'text-red-500'
    },
    {
      title: '117 Performance',
      description: 'Performance analysis and monitoring',
      icon: <IconChartBar size={24} />,
      path: '/117performance',
      color: 'text-emerald-500'
    }
  ];

  const mainFeatures = [
    {
      title: 'Map',
      description: 'Interactive map viewer',
      icon: <IconMap size={32} />,
      path: '/map',
      color: 'text-teal-500',
      bgColor: 'bg-teal-500/10'
    },
    {
      title: 'API Documentation',
      description: 'Browse API endpoints and documentation',
      icon: <IconCode size={32} />,
      path: '/api-docs',
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Welcome to OpenRune
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Explore, browse, and interact with RuneScape cache data. View game objects, items, NPCs, sprites, textures, and more.
        </p>
      </div>

      {/* Main Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {mainFeatures.map((feature) => (
          <Link key={feature.path} href={feature.path}>
            <Card className="hover:shadow-xl transition-all cursor-pointer h-full border-2 hover:border-primary/50 hover:scale-[1.02]">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-4">
                  <div className={`p-4 ${feature.bgColor} rounded-xl`}>
                    <div className={feature.color}>
                      {feature.icon}
                    </div>
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-2xl mb-1">{feature.title}</CardTitle>
                    <CardDescription className="text-base">{feature.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" size="sm" className="w-full">
                  Open <IconArrowRight size={16} className="ml-2" />
                </Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Game Entities Section */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg">
            <IconCube className="text-primary" size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-bold">Game Entities</h2>
            <p className="text-muted-foreground">Browse game objects, items, and NPCs</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gameEntities.map((entity) => (
            <Link key={entity.path} href={entity.path}>
              <Card className="hover:shadow-lg transition-all cursor-pointer h-full border hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 bg-primary/10 rounded-lg ${entity.color}`}>
                      {entity.icon}
                    </div>
                    <CardTitle className="text-lg">{entity.title}</CardTitle>
                  </div>
                  <CardDescription>{entity.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" size="sm" className="w-full">
                    Explore <IconArrowRight size={16} className="ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Visual Assets Section */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg">
            <IconPhoto className="text-primary" size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-bold">Visual Assets</h2>
            <p className="text-muted-foreground">View sprites, textures, animations, and overlays</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visualAssets.map((asset) => (
            <Link key={asset.path} href={asset.path}>
              <Card className="hover:shadow-lg transition-all cursor-pointer h-full border hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 bg-primary/10 rounded-lg ${asset.color}`}>
                      {asset.icon}
                    </div>
                    <CardTitle className="text-lg">{asset.title}</CardTitle>
                  </div>
                  <CardDescription>{asset.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" size="sm" className="w-full">
                    Explore <IconArrowRight size={16} className="ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Tools Section */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg">
            <IconTools className="text-primary" size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-bold">Tools</h2>
            <p className="text-muted-foreground">Utility tools and helpers</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tools.map((tool) => (
            <Link key={tool.path} href={tool.path}>
              <Card className="hover:shadow-lg transition-all cursor-pointer h-full border hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 bg-primary/10 rounded-lg ${tool.color}`}>
                      {tool.icon}
                    </div>
                    <CardTitle className="text-lg">{tool.title}</CardTitle>
                  </div>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" size="sm" className="w-full">
                    Open <IconArrowRight size={16} className="ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Features Section */}
      <Card className="bg-muted/50 border-2">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <IconSettings className="text-primary" size={24} />
            </div>
            <div>
              <CardTitle className="text-2xl">Features</CardTitle>
              <CardDescription>What you can do with OpenRune</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <IconSettings size={20} className="text-primary" />
                Server Management
              </h3>
              <p className="text-sm text-muted-foreground">
                Switch between different cache servers and manage your connections seamlessly.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <IconPhoto size={20} className="text-primary" />
                Image Viewing
              </h3>
              <p className="text-sm text-muted-foreground">
                View and download sprites, textures, and other game assets with ease.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <IconCode size={20} className="text-primary" />
                API Access
              </h3>
              <p className="text-sm text-muted-foreground">
                Access comprehensive REST API documentation and test endpoints directly.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
