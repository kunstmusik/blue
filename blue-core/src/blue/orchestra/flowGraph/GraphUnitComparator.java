package blue.orchestra.flowGraph;

import java.util.Comparator;

class GraphUnitComparator implements Comparator {
    @Override
    public int compare(Object o1, Object o2) {
        GraphUnit a = (GraphUnit) o1;
        GraphUnit b = (GraphUnit) o2;

        double x1 = a.coordinate.x;
        double y1 = a.coordinate.y;

        double x2 = b.coordinate.x;
        double y2 = b.coordinate.y;

        if (y1 > y2) {
            return 1;
        } else if (y1 < y2) {
            return -1;
        } else if (x1 > x2) {
            return 1;
        } else if (x1 < x2) {
            return -1;
        }

        return 0;

    }

}