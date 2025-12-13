import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const Stats = () => {
  const stats = [
    { value: 15, label: "Années d'existence" },
    { value: 500, label: "Membres" },
    { value: 30, label: "Projets" },
  ];

  const [counts, setCounts] = useState(stats.map(() => 0));
  const [hasAnimated, setHasAnimated] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          stats.forEach((stat, index) => {
            const increment = stat.value / 100;
            let current = 0;
            const timer = setInterval(() => {
              current += increment;
              if (current >= stat.value) {
                current = stat.value;
                clearInterval(timer);
              }
              setCounts((prev) => {
                const newCounts = [...prev];
                newCounts[index] = Math.ceil(current);
                return newCounts;
              });
            }, 20);
          });
        }
      },
      { threshold: 0.5 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [hasAnimated]);

  return (
    <section ref={sectionRef} id="stats" className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="p-8 rounded-3xl bg-card/80 border border-white/5 backdrop-blur-sm"
            >
              <div className="text-6xl md:text-7xl font-black bg-gradient-to-br from-white to-cap-blue bg-clip-text text-transparent">
                {counts[index]}
                {stat.value === 500 && "+"}
              </div>
              <p className="text-xl text-gray-400 mt-4 uppercase tracking-wider">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
