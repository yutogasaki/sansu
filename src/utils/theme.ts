export const getThemeForHour = (hour: number) => {
    if (hour >= 18 || hour < 4) {
        return "evening" as const;
    }

    if (hour >= 10 && hour < 18) {
        return "day" as const;
    }

    return null;
};

export const applyThemeForCurrentTime = (date = new Date()) => {
    const theme = getThemeForHour(date.getHours());

    if (theme) {
        document.documentElement.setAttribute("data-theme", theme);
        return;
    }

    document.documentElement.removeAttribute("data-theme");
};

export const getMsUntilNextThemeCheck = (date = new Date()) => {
    const nextHour = new Date(date);
    nextHour.setHours(date.getHours() + 1, 0, 0, 0);
    return Math.max(1000, nextHour.getTime() - date.getTime());
};
