export interface VerticalScrollMetrics {
    scrollTop: number;
    clientHeight: number;
    scrollHeight: number;
}

export function hasMoreContentBelow({ scrollTop, clientHeight, scrollHeight }: VerticalScrollMetrics): boolean {
    const maxScrollTop = scrollHeight - clientHeight;
    return maxScrollTop > 1 && scrollTop < maxScrollTop - 1;
}
