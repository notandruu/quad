import Header from "@/components/Header";
import Hero from "@/components/sections/Hero";
import Intro from "@/components/sections/Intro";
import Content from "@/components/sections/Content";
import Capabilities from "@/components/sections/Capabilities";
import Numbers from "@/components/sections/Numbers";
import Features from "@/components/sections/Features";
import Integrations from "@/components/sections/Integrations";
import TrustGaps from "@/components/sections/TrustGaps";
import Security from "@/components/sections/Security";
import QuadChain from "@/components/sections/QuadChain";
import FAQ from "@/components/sections/FAQ";
import Footer from "@/components/sections/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Intro />
        <Content>
          <Capabilities />
          <Numbers />
          <Features />
          <Integrations />
          <TrustGaps />
          <Security />
          <QuadChain />
          <FAQ />
        </Content>
        <Footer />
      </main>
    </>
  );
}
