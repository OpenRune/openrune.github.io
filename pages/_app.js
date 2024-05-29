import Layout from '../components/Layout'

import SEO from '/next-seo.config'
import { DefaultSeo } from 'next-seo'
import '../styles/theme.css'
import React from "react";
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const MyApp = ({ Component, pageProps }) => {
    const router = useRouter();

    useEffect(() => {
        const handleRouteChange = () => {
            // Logic to handle route change if needed
        };

        router.events.on('routeChangeComplete', handleRouteChange);

        return () => {
            router.events.off('routeChangeComplete', handleRouteChange);
        };
    }, [router.events]);

    return (
        <Layout>
            <DefaultSeo {...SEO} />
            <div className="grid">
                <div className="col-12">
                    <div className="card">
                        <Component {...pageProps} />
                    </div>
                </div>
            </div>
        </Layout>
    );
};
export default MyApp
