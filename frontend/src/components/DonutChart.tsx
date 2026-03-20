import { View, Text } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import type { TopKPrediction } from "../types";

interface DonutChartProps {
  predictions: TopKPrediction[];
}

const COLORS = ["#4361ee", "#7b2ff7", "#f57c00", "#c4c4c4"];

const DonutChart = ({ predictions }: DonutChartProps) => {
  const top3 = predictions.slice(0, 3);
  const top3Sum = top3.reduce((s, p) => s + p.probability, 0);
  const othersValue = Math.max(0, 1 - top3Sum);

  const slices = [
    ...top3.map((p, i) => ({
      label: p.breed_ko || p.breed,
      value: p.probability,
      pct: (p.probability * 100).toFixed(1),
      color: COLORS[i],
    })),
    ...(othersValue > 0.005
      ? [
          {
            label: "Others",
            value: othersValue,
            pct: (othersValue * 100).toFixed(1),
            color: COLORS[3],
          },
        ]
      : []),
  ];

  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 65;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;
  const arcs = slices.map((s) => {
    const dashLen = s.value * circumference;
    const dashOffset = -cumulative * circumference;
    cumulative += s.value;
    return { ...s, dashLen, dashOffset };
  });

  return (
    <View className="items-center gap-4">
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((arc, i) => (
          <Circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={28}
            strokeDasharray={`${arc.dashLen} ${circumference - arc.dashLen}`}
            strokeDashoffset={arc.dashOffset}
            rotation={-90}
            origin={`${cx}, ${cy}`}
          />
        ))}
        <SvgText
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fontSize={20}
          fontWeight="bold"
          fill="#1f2937"
        >
          {(slices[0]?.value * 100 || 0).toFixed(1)}%
        </SvgText>
        <SvgText
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          fontSize={12}
          fill="#6b7280"
        >
          TOP 1
        </SvgText>
      </Svg>

      <View className="w-full gap-2">
        {slices.map((s, i) => (
          <View key={i} className="flex-row items-center gap-2">
            <View
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <Text className="flex-1 text-sm text-gray-700">{s.label}</Text>
            <Text className="text-sm font-medium text-gray-900">{s.pct}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default DonutChart;
