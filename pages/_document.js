// pages/_document.js
import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
    static async getInitialProps(ctx) {
        const initialProps = await Document.getInitialProps(ctx);
        return { ...initialProps };
    }

    render() {
        return (
            <Html>
                <Head>
                    {/* Default base URL */}
                    <base id="base-tag" href="/" />
                    <script
                        dangerouslySetInnerHTML={{
                            __html: `
                (function() {
                  var hostname = window.location.hostname;
                  var pathArray = window.location.pathname.split('/');
                  var baseUrl = hostname === 'openrune.github.io' && pathArray.length > 1 ? '/' + pathArray[1] : '';
                  document.getElementById('base-tag').setAttribute('href', baseUrl);
                })();
              `,
                        }}
                    />
                </Head>
                <body>
                <Main />
                <NextScript />
                </body>
            </Html>
        );
    }
}

export default MyDocument;