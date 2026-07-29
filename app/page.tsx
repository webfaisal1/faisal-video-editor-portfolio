import SmoothScroll from "@/components/providers/SmoothScroll";
import Nav from "@/components/sections/Nav";
import Showcase from "@/components/sections/Showcase";
import About from "@/components/sections/About";
import LongForm from "@/components/sections/LongForm";
import ShortForm from "@/components/sections/ShortForm";
import Thumbnails from "@/components/sections/Thumbnails";
import HowIWork from "@/components/sections/HowIWork";
import Services from "@/components/sections/Services";
import Testimonials from "@/components/sections/Testimonials";
import Faq from "@/components/sections/Faq";
import Contact from "@/components/sections/Contact";
import Footer from "@/components/sections/Footer";
import VideoPopup from "@/components/sections/VideoPopup";

// Section order preserved exactly from the original single-file build.
// VideoPopup renders last (the shared overlay) and wires the already-mounted Long Form tiles,
// exposing window.__openVideoPopup which Short Form calls.
export default function Home() {
  return (
    <SmoothScroll>
      <Nav />
      <Showcase />
      <About />
      <LongForm />
      <ShortForm />
      <Thumbnails />
      <HowIWork />
      <Services />
      <Testimonials />
      <Faq />
      <Contact />
      <Footer />
      <VideoPopup />
    </SmoothScroll>
  );
}
