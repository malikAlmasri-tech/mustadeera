import { useEffect } from "react";
import { CircleDot, Store, User, Volleyball, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

import { FallbackComponent } from "./CustomComponents";

export default function App() {
  return (
    <div>
      <div className="bg-white text-neutral-950 w-full h-fit h-fit min-h-screen w-screen min-w-screen max-w-screen overflow-visible">
        <div className="relative min-h-[874px] flex flex-col w-full">
          <div className="absolute inset-0">
            <img
              src="https://images.unsplash.com/photo-1704633785114-52104ce3d626?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3ODc2NDd8MHwxfHNlYXJjaHwxfHxmb290YmFsbCUyMHNvY2NlciUyMGZpZWxkJTIwZ3JlZW4lMjBwaXRjaHxlbnwxfDF8fHwxNzg0ODAxNzgwfDA&ixlib=rb-4.1.0&q=80&w=400"
              alt="Sports court background"
              className="object-cover w-full h-full"
              data-photoid="dxcVW0W_q_o"
              data-authorname="Kyle Hinkson"
              data-authorurl="https://unsplash.com/@whereiskylenow"
              data-blurhash="L36bY#V@4UIUO7ofM{WB8zWCx[-q"
            />
            <div className="bg-[linear-gradient(to_bottom,oklch(0.145_0_0/.55),oklch(0.145_0_0/.35)_45%,oklch(0.145_0_0/.88))] absolute inset-0" />
          </div>
          <div className="relative flex p-8 flex-col flex-1">
            <div className="flex pt-4 justify-center items-center gap-2">
              <div className="size-10 rounded-full bg-neutral-900 text-neutral-50 flex justify-center items-center">
                <Volleyball className="size-6" />
              </div>
              <span className="font-semibold uppercase text-white/90 text-sm leading-5 tracking-widest">
                Al-Mustadaira
              </span>
            </div>
            <div className="text-center flex flex-col justify-center items-center flex-1 gap-6">
              <div className="size-24 shadow-2xl rounded-3xl bg-neutral-900 text-neutral-50 flex justify-center items-center">
                <Volleyball className="size-12" />
              </div>
              <div className="flex flex-col gap-2">
                <h1 className="font-bold text-white text-4xl leading-10 tracking-tight">
                  Al-Mustadaira
                </h1>
                <p className="text-white/80 text-base leading-6">
                  Book Your Sports Court Instantly
                </p>
              </div>
              <div className="flex pt-2 items-center gap-3">
                <div className="flex flex-col items-center gap-1">
                  <div className="size-11 backdrop-blur-sm rounded-2xl bg-white/15 text-white flex justify-center items-center">
                    <Volleyball className="size-5" />
                  </div>
                  <span className="text-white/70 text-xs leading-4">
                    Football
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="size-11 backdrop-blur-sm rounded-2xl bg-white/15 text-white flex justify-center items-center">
                    <Zap className="size-5" />
                  </div>
                  <span className="text-white/70 text-xs leading-4">Padel</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="size-11 backdrop-blur-sm rounded-2xl bg-white/15 text-white flex justify-center items-center">
                    <FallbackComponent className="size-5" />
                  </div>
                  <span className="text-white/70 text-xs leading-4">
                    Basketball
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="size-11 backdrop-blur-sm rounded-2xl bg-white/15 text-white flex justify-center items-center">
                    <CircleDot className="size-5" />
                  </div>
                  <span className="text-white/70 text-xs leading-4">
                    Tennis
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="backdrop-blur-md rounded-2xl bg-white/10 flex p-1 items-center gap-2">
                <button className="font-medium rounded-xl text-sm leading-5 flex py-2.5 justify-center items-center flex-1 gap-2">
                  <User className="size-4" />
                  Player
                </button>
                <button className="font-medium rounded-xl text-sm leading-5 flex py-2.5 justify-center items-center flex-1 gap-2">
                  <Store className="size-4" />
                  Venue Owner
                </button>
              </div>
              <Button className="font-semibold rounded-2xl bg-neutral-900 text-neutral-50 text-base leading-6 w-full h-12">
                <User className="size-5" />
                Continue as Player
              </Button>
              <Button className="font-semibold rounded-2xl bg-neutral-900 text-neutral-50 text-base leading-6 hidden w-full h-12">
                <Store className="size-5" />
                Continue as Venue Owner
              </Button>
              <Button
                variant="outline"
                className="font-medium rounded-2xl bg-white/5 text-white text-base leading-6 border-white/40 border-0 border-solid w-full h-12"
              >
                I already have an account
              </Button>
              <p className="text-center text-white/60 text-xs leading-4 pt-2">
                By continuing you agree to our
                <span className="underline">Terms of Service</span>and
                <span className="underline">Privacy Policy</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
