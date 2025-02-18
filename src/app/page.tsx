import Layout from "@/components/Layout";

export default function Home() {
  return (
    <Layout>
      <div className="hero min-h-screen bg-base-200">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="text-5xl font-bold text-primary">
              Welcome to Domain Reputation Platform
            </h1>
            <p className="py-6 text-base-content">
              Your first step towards managing domain reputation
            </p>
            <button className="btn btn-primary">Get Started</button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
