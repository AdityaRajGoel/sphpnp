import { MessageCircle } from "lucide-react";

const WhatsAppButton = () => {
  const phoneNumber = "919416400314";
  const message = "Hello! I'm interested in learning more about your investment services at Parasram Panipat.";
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      // Lifts clear of the cookie prompt while it is open, like the other bottom-docked UI.
      className="fixed bottom-[calc(1.5rem+var(--consent-dock-height,0px))] max-md:bottom-[calc(1.5rem+var(--consent-dock-height,0px)+var(--sticky-cta-height,0px))] right-6 z-50 flex items-center gap-3 group transition-[transform,bottom] duration-base active:scale-[0.97] pb-[env(safe-area-inset-bottom)]"
    >
      {/* Tooltip */}
      <div className="hidden md:block bg-card/90 backdrop-blur-md text-foreground px-4 py-2 rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] opacity-0 group-hover:opacity-100 transition-[opacity,transform] ease-out duration-base whitespace-nowrap translate-x-4 group-hover:translate-x-0">
        <span className="text-sm font-medium">Chat with us!</span>
      </div>

      {/* Button */}
      <div className="relative">
        {/* No pulse ring: a permanently throbbing button pulls the eye from the
            page it sits on, and its scaled ring spilled past a phone's edge. */}
        {/* Main button */}
        <div className="relative w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-lg transition-colors duration-base">
          <MessageCircle className="w-7 h-7 text-white" />
        </div>
      </div>
    </a>
  );
};

export default WhatsAppButton;
