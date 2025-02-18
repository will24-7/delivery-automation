import React, { ReactNode } from "react";
import Head from "next/head";
import Link from "next/link";

// Interface to define props for the Layout component
interface LayoutProps {
  children: ReactNode;
  title?: string;
}

/**
 * NavBar component for the website
 * Displays website name and provides navigation
 */
const NavBar: React.FC = () => {
  return (
    <div className="navbar bg-base-100 shadow-md">
      <div className="flex-1 justify-center">
        <Link href="/" className="btn btn-ghost normal-case text-xl">
          Domain Reputation Platform
        </Link>
      </div>
    </div>
  );
};

/**
 * Footer component with copyright information
 */
const Footer: React.FC = () => {
  return (
    <footer className="footer footer-center p-4 bg-base-300 text-base-content">
      <div>
        <p>
          © {new Date().getFullYear()} Domain Reputation Platform. All rights
          reserved. Developed by Your Company Name.
        </p>
      </div>
    </footer>
  );
};

/**
 * Layout component that provides a consistent structure for pages
 * Includes:
 * - Dynamic page title
 * - Navigation bar
 * - Main content area
 * - Footer
 */
const Layout: React.FC<LayoutProps> = ({
  children,
  title = "Domain Reputation Platform",
}) => {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Head section for dynamic page titles */}
      <Head>
        <title>{title}</title>
        <meta
          name="description"
          content="Domain Reputation and Inboxing Rotation Platform"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Navigation Bar */}
      <NavBar />

      {/* Main content area with padding */}
      <main className="flex-grow container mx-auto px-4 py-8 w-full">
        {children}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Layout;
export { NavBar, Footer };
