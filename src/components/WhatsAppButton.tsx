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
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 group transition-transform hover:scale-105 active:scale-[0.97] pb-[env(safe-area-inset-bottom)]"
    >
      {/* Tooltip */}
      <div className="hidden md:block bg-card/90 backdrop-blur-md text-foreground px-4 py-2 rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] opacity-0 group-hover:opacity-100 transition-[opacity,transform] ease-out duration-base whitespace-nowrap translate-x-4 group-hover:translate-x-0">
        <span className="text-sm font-medium">Chat with us!</span>
      </div>

      {/* Button */}
      <div className="relative">
        {/* Pulse ring using Tailwind ping. Exempt from the capped UI duration
            scale: this is a continuous decorative loop, not feedback, and at
            the 360ms `slow` token it would read as a flicker. */}
        <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-30 duration-ambient" />
        
        {/* Main button */}
        <div className="relative w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 transition-colors duration-base">
          <MessageCircle className="w-7 h-7 text-white" />
        </div>
      </div>
    </a>
  );
};

export default WhatsAppButton;
