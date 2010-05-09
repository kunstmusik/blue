/*
 * @(#) PnutsLayout.java	1.1 03/10/10
 *
 * Copyright (c) 1997-2003 Sun Microsystems, Inc. All Rights Reserved.
 *
 * See the file "LICENSE.txt" for information on usage and redistribution
 * of this file, and for a DISCLAIMER OF ALL WARRANTIES.
 */
package pnuts.awt;

import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.Insets;
import java.awt.LayoutManager;
import java.awt.LayoutManager2;
import java.awt.Point;
import java.awt.Rectangle;
import java.util.BitSet;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.StringTokenizer;

/**
 * The PnutsLayout is a general purpose geometry manager. It is more
 * user-friendly than any LayoutManager out there and as flexible as
 * GridBagLayout. e.g.
 * 
 * <pre>
 * setLayout(new PnutsLayout(&quot;cols = 3&quot;));
 * add(button1, &quot;ipadx = 20, ipady = 20&quot;);
 * add(button2, &quot;padx = 20, pady = 20&quot;);
 * add(button3, &quot;colspan = 2&quot;);
 * add(button4, &quot;rowspan = 2&quot;);
 * add(button3, &quot;halign = left, valign = top&quot;);
 * add(button3, &quot;halign = right, valign = bottom&quot;);
 * add(button3, &quot;halign = center, valign = fill&quot;);
 * </pre>
 * 
 * <table border>
 * <tr>
 * <th>property</th>
 * <th>the meaning</th>
 * <th>default</th>
 * </tr>
 * <tr>
 * <td>cols</td>
 * <td>number of columns</td>
 * <td>1</td>
 * </tr>
 * <tr>
 * <td>uniform</td>
 * <td>if width and/or height of each columns are all same, "x", "y" or "xy"</td>
 * <td>""</td>
 * </tr>
 * <tr>
 * <td>colspan</td>
 * <td>number of columns the component occupies</td>
 * <td>1</td>
 * </tr>
 * <tr>
 * <td>rowspan</td>
 * <td>number of rows the component occupies</td>
 * <td>1</td>
 * </tr>
 * <tr>
 * <td>padx</td>
 * <td>external padding (x)</td>
 * <td>0</td>
 * </tr>
 * <tr>
 * <td>pady</td>
 * <td>external padding (y)</td>
 * <td>0</td>
 * </tr>
 * <tr>
 * <td>ipadx</td>
 * <td>internal padding (x)</td>
 * <td>0</td>
 * </tr>
 * <tr>
 * <td>ipady</td>
 * <td>internal padding (y)</td>
 * <td>0</td>
 * </tr>
 * <tr>
 * <td>halign</td>
 * <td>alignment of x. One of "left", "right", "center", "fill"</td>
 * <td>center</td>
 * </tr>
 * <tr>
 * <td>valign</td>
 * <td>alignment of y. One of "top", "bottom", "center", "fill"</td>
 * <td>center</td>
 * </tr>
 * <tr>
 * <td>expand</td>
 * <td>expand as the size of container changes. one of "x", "y", "xy"</td>
 * <td>""</td>
 * </tr>
 * </table>
 * 
 * <p>
 * 
 * @version 1.1
 * @autor Toyokazu Tomatsu
 */

public class PnutsLayout implements LayoutManager2, java.io.Serializable {

    public static final int CENTER = 0;

    public static final int TOP = 1;

    public static final int BOTTOM = 2;

    public static final int LEFT = 4;

    public static final int RIGHT = 8;

    public static final int V_FIT = 16;

    public static final int H_FIT = 32;

    static final int V_FILL = TOP | BOTTOM;

    static final int H_FILL = LEFT | RIGHT;

    static Integer[] integer = new Integer[33];
    static {
        for (int i = 0; i < integer.length; i++) {
            integer[i] = new Integer(i);
        }
    }

    static Integer getInteger(int i) {
        if (i < 32) {
            return integer[i];
        } else {
            return new Integer(i);
        }
    }

    static int zero[] = new int[16];
    static {
        for (int i = 0; i < zero.length; i++) {
            zero[i] = 0;
        }
    }

    /**
     * alignment table
     * 
     * @serial
     */
    Hashtable alignmentTable = new Hashtable();

    /**
     * span table
     * 
     * @serial
     */
    Hashtable spanTable = new Hashtable();

    /**
     * padx/y table
     * 
     * @serial
     */
    Hashtable padTable = new Hashtable();

    /**
     * ipadx/y table
     * 
     * @serial
     */
    Hashtable iPadTable = new Hashtable();

    /**
     * @serial
     */
    private int widths[];

    /**
     * @serial
     */
    private int heights[];

    /**
     * @serial
     */
    private int hfit[];

    /**
     * @serial
     */
    private int vfit[];

    /**
     * @serial
     */
    private int hfits;

    /**
     * @serial
     */
    private int vfits;

    /**
     * @serial
     */
    int grid_x[];

    /**
     * @serial
     */
    int grid_y[];

    /**
     * @serial
     */
    int pos_x[] = new int[8];

    /**
     * @serial
     */
    int pos_y[] = new int[8];

    /**
     * @serial
     */
    private Dimension psize;

    /**
     * @serial
     */
    private boolean valid = false;

    /**
     * default align
     * 
     * @serial
     */
    protected int align = CENTER;

    /**
     * default padx
     * 
     * @serial
     */
    protected int padx;

    /**
     * default pady
     * 
     * @serial
     */
    protected int pady;

    /**
     * default ipadx
     * 
     * @serial
     */
    protected int ipadx;

    /**
     * default ipady
     * 
     * @serial
     */
    protected int ipady;

    /**
     * The number of columns
     * 
     * @serial
     */
    protected int cols;

    /**
     * The number of rows
     * 
     * @serial
     */
    protected int rows;

    /**
     * @serial
     */
    protected boolean xfix;

    /**
     * @serial
     */
    protected boolean yfix;

    /**
     * construct a PnutsLayout
     */
    public PnutsLayout() {
        this(1);
    }

    /**
     * construct a PnutsLayout with specified number of columns
     * 
     * @param cols
     *            the number of columns
     */
    public PnutsLayout(int cols) {
        this(cols, 0, 0);
    }

    /**
     * construct a PnutsLayout
     * 
     * @param cols
     *            the number of columns
     * @param padx
     *            default external padding
     * @param pady
     *            default external padding
     */
    public PnutsLayout(int cols, int padx, int pady) {
        this.cols = cols;
        this.padx = padx;
        this.pady = pady;
    }

    /*
     * construct a PnutsLayout from a constraint string. Usage: "cols=<number>,
     * padx=<number>, pady=<number>, uniform=<x | y | xy>"
     * 
     * @param str a constraint string
     */
    public PnutsLayout(String str) {
        Hashtable t = str2table(str);

        this.cols = getInt(t.get("cols"), 1);
        this.padx = getInt(t.get("padx"), 0);
        this.pady = getInt(t.get("pady"), 0);
        this.ipadx = getInt(t.get("ipadx"), 0);
        this.ipady = getInt(t.get("ipady"), 0);

        int ha = 0;
        int va = 0;

        String h = (String) t.get("halign");
        if (h != null) {
            if ("left".equalsIgnoreCase(h)) {
                ha |= LEFT;
            } else if ("right".equalsIgnoreCase(h)) {
                ha |= RIGHT;
            } else if ("center".equalsIgnoreCase(h)) {
                ha |= CENTER;
            } else if ("fill".equalsIgnoreCase(h)) {
                ha |= RIGHT;
                ha |= LEFT;
            }
        } else {
            ha = this.align & (LEFT | RIGHT | H_FIT);
        }

        String v = (String) t.get("valign");
        if (v != null) {
            if ("top".equalsIgnoreCase(v)) {
                va |= TOP;
            } else if ("bottom".equalsIgnoreCase(v)) {
                va |= BOTTOM;
            } else if ("center".equalsIgnoreCase(v)) {
                va |= CENTER;
            } else if ("fill".equalsIgnoreCase(v)) {
                va |= TOP;
                va |= BOTTOM;
            }
        } else {
            va = this.align & (TOP | BOTTOM | V_FIT);
        }

        String ex = (String) t.get("expand");

        if ("x".equalsIgnoreCase(ex)) {
            ha |= H_FIT;
        } else if ("y".equalsIgnoreCase(ex)) {
            va |= V_FIT;
        } else if ("xy".equalsIgnoreCase(ex)) {
            ha |= H_FIT;
            va |= V_FIT;
        }

        this.align = ha | va;

        String fix = (String) t.get("uniform");
        if ("x".equals(fix)) {
            xfix = true;
        } else if ("y".equals(fix)) {
            yfix = true;
        } else if ("xy".equals(fix)) {
            xfix = true;
            yfix = true;
        }
    }

    /**
     * Adds the specified component to the layout, using the specified
     * constraint object.
     * 
     * @param comp
     *            the component to be added.
     * @param obj
     *            an object that determines how the component is added to the
     *            layout. Usage: container.add(component, new Object[]{align,
     *            colspan, rowspan});
     */
    public void addLayoutComponent(Component comp, Object obj) {
        if (obj instanceof Hashtable) {
            setConstraints(comp, (Hashtable) obj);
        } else if (obj instanceof String) {
            setConstraints(comp, (String) obj);
        }
    }

    /**
     * Specify layout constraints with comma-separated list of "<property>=<value>".
     * 
     * halign ::= left | right | center | fill valign ::= top | bottom | center |
     * fill expand ::= x | y | xy
     * 
     * @param comp
     *            the component
     * @param str
     *            a string that describes how the component is added to the
     *            layout.
     */
    public void setConstraints(Component comp, String str) {
        int hal = this.align & (LEFT | RIGHT | H_FIT);
        int val = this.align & (TOP | BOTTOM | V_FIT);
        Hashtable tab = str2table(str);

        Object v0 = tab.get("expand");
        if (v0 instanceof String) {
            String s = (String) v0;
            if ("x".equalsIgnoreCase(s)) {
                hal |= H_FIT;
            } else if ("y".equalsIgnoreCase(s)) {
                val |= V_FIT;
            } else if ("xy".equalsIgnoreCase(s)) {
                hal |= H_FIT;
                val |= V_FIT;
            }
        }

        Object v1 = tab.get("halign");
        if (v1 instanceof String) {
            hal &= ~(LEFT | RIGHT);
            String s = (String) v1;
            if ("left".equalsIgnoreCase(s)) {
                hal |= LEFT;
            } else if ("right".equalsIgnoreCase(s)) {
                hal |= RIGHT;
            } else if ("center".equalsIgnoreCase(s)) {
                hal |= CENTER;
            } else if ("fill".equalsIgnoreCase(s)) {
                hal |= RIGHT;
                hal |= LEFT;
            }
        }

        Object v2 = tab.get("valign");
        if (v2 instanceof String) {
            val &= ~(TOP | BOTTOM);
            String s = (String) v2;
            if ("top".equalsIgnoreCase(s)) {
                val |= TOP;
            } else if ("bottom".equalsIgnoreCase(s)) {
                val |= BOTTOM;
            } else if ("center".equalsIgnoreCase(s)) {
                val |= CENTER;
            } else if ("fill".equalsIgnoreCase(s)) {
                val |= TOP;
                val |= BOTTOM;
            }
        }

        tab.put("valign", getInteger(val));
        tab.put("halign", getInteger(hal));

        setConstraints(comp, tab);
    }

    static int getInt(Object obj, int defaultValue) {
        if (obj == null) {
            return defaultValue;
        }
        if (obj instanceof Integer) {
            return ((Integer) obj).intValue();
        } else {
            return Integer.parseInt((String) obj);
        }
    }

    /**
     * Specify layout constraints with Hashtable
     * 
     * @param comp
     *            the component to be set the constraint.
     * @param table
     *            a Hashtable that describes how the component is added to the
     *            layout.
     */
    public void setConstraints(Component comp, Hashtable table) {

        int h = getInt(table.get("halign"), this.align & (LEFT | RIGHT));
        int v = getInt(table.get("valign"), this.align & (TOP | BOTTOM));
        alignmentTable.put(comp, getInteger(h | v));

        int c = getInt(table.get("colspan"), 1);
        if (c <= cols) {
            spanTable.put(comp, new Object[] { getInteger(c),
                    getInteger(getInt(table.get("rowspan"), 1)) });
        }

        padTable.put(comp, new Object[] {
                getInteger(getInt(table.get("padx"), this.padx)),
                getInteger(getInt(table.get("pady"), this.pady)) });

        iPadTable.put(comp, new Object[] {
                getInteger(getInt(table.get("ipadx"), this.ipadx)),
                getInteger(getInt(table.get("ipady"), this.ipady)) });
    }

    /**
     * get a string representaion of constraint for the specified component
     * 
     * @param comp
     *            the component to be investigate
     * @return string representaion of the constraint
     */
    public String getConstraintString(Component comp) {
        Hashtable tab = getConstraints(comp);
        StringBuffer buf = new StringBuffer();

        String halign = (String) tab.get("halign");
        if (halign != null) {
            buf.append("halign = " + halign);
        }
        String valign = (String) tab.get("valign");
        if (valign != null) {
            if (buf.length() > 0) {
                buf.append(", ");
            }
            buf.append("valign = " + valign);
        }

        String expand = (String) tab.get("expand");
        if (expand != null) {
            if (buf.length() > 0) {
                buf.append(", ");
            }
            buf.append("expand = " + expand);
        }

        int padx = ((Integer) tab.get("padx")).intValue();
        if (padx > 0) {
            if (buf.length() > 0) {
                buf.append(", ");
            }
            buf.append("padx = " + padx);
        }
        int pady = ((Integer) tab.get("pady")).intValue();
        if (pady > 0) {
            if (buf.length() > 0) {
                buf.append(", ");
            }
            buf.append("pady = " + pady);
        }
        int ipadx = ((Integer) tab.get("ipadx")).intValue();
        if (ipadx > 0) {
            if (buf.length() > 0) {
                buf.append(", ");
            }
            buf.append("ipadx = " + ipadx);
        }
        int ipady = ((Integer) tab.get("ipady")).intValue();
        if (ipady > 0) {
            if (buf.length() > 0) {
                buf.append(", ");
            }
            buf.append("ipady = " + ipady);
        }
        int colspan = ((Integer) tab.get("colspan")).intValue();
        if (colspan > 1) {
            if (buf.length() > 0) {
                buf.append(", ");
            }
            buf.append("colspan = " + colspan);
        }
        int rowspan = ((Integer) tab.get("rowspan")).intValue();
        if (rowspan > 1) {
            if (buf.length() > 0) {
                buf.append(", ");
            }
            buf.append("rowspan = " + rowspan);
        }
        return buf.toString();
    }

    /**
     * get a Hashtable of constraint for the specified component
     * 
     * @param comp
     *            the component to be investigate
     * @return the constraints as Hashtable
     */
    public Hashtable getConstraints(Component comp) {
        Hashtable tab = new Hashtable();
        Object o1 = alignmentTable.get(comp);
        int align = this.align;
        if (o1 != null) {
            align = ((Integer) o1).intValue();
            String halign = "center";
            String valign = "center";
            switch (align & H_FILL) {
                case LEFT:
                    halign = "left";
                    break;
                case RIGHT:
                    halign = "right";
                    break;
                case H_FILL:
                    halign = "fill";
                    break;
            }
            switch (align & V_FILL) {
                case TOP:
                    valign = "top";
                    break;
                case BOTTOM:
                    valign = "bottom";
                    break;
                case V_FILL:
                    valign = "fill";
                    break;
            }
            if (!"center".equals(halign)) {
                tab.put("halign", halign);
            }
            if (!"center".equals(valign)) {
                tab.put("valign", valign);
            }

            String expand = "";
            if ((align & H_FIT) == H_FIT) {
                expand += "x";
            }
            if ((align & V_FIT) == V_FIT) {
                expand += "y";
            }
            if (expand.length() > 0) {
                tab.put("expand", expand);
            }
        }
        Object[] o2 = (Object[]) padTable.get(comp);
        if (o2 != null) {
            tab.put("padx", o2[0]);
            tab.put("pady", o2[1]);
        }
        Object o3[] = (Object[]) iPadTable.get(comp);
        if (o3 != null) {
            tab.put("ipadx", o3[0]);
            tab.put("ipady", o3[1]);
        }
        Object o4[] = (Object[]) spanTable.get(comp);
        if (o4 != null) {
            tab.put("colspan", o4[0]);
            tab.put("rowspan", o4[1]);
        }
        return tab;
    }

    /**
     * Adds the specified component with the specified name to the layout.
     * 
     * @param name
     *            the component name
     * @param comp
     *            the component to be added
     */
    public void addLayoutComponent(String name, Component comp) {
    }

    /**
     * Removes the specified component from the layout.
     * 
     * @param comp
     *            the component ot be removed
     */
    public void removeLayoutComponent(Component comp) {
    }

    /**
     * Returns the maximum size of this component.
     * 
     * @see java.awt.Component#getMinimumSize()
     * @see java.awt.Component#getPreferredSize()
     * @see LayoutManager
     */
    public Dimension maximumLayoutSize(Container target) {
        return target.getMaximumSize();
    }

    /**
     * Returns the alignment along the x axis. This specifies how the component
     * would like to be aligned relative to other components. The value should
     * be a number between 0 and 1 where 0 represents alignment along the
     * origin, 1 is aligned the furthest away from the origin, 0.5 is centered,
     * etc.
     */
    public float getLayoutAlignmentX(Container target) {
        return 0f;
    }

    /**
     * Returns the alignment along the y axis. This specifies how the component
     * would like to be aligned relative to other components. The value should
     * be a number between 0 and 1 where 0 represents alignment along the
     * origin, 1 is aligned the furthest away from the origin, 0.5 is centered,
     * etc.
     */
    public float getLayoutAlignmentY(Container target) {
        return 0f;
    }

    /**
     * Invalidates the layout, indicating that if the layout manager has cached
     * information it should be discarded.
     * 
     * @param target
     *            container to invalidate the layout
     */
    public void invalidateLayout(Container target) {
        valid = false;
    }

    /**
     * Set the number of columns
     * 
     * @param cols
     *            the number of columns
     */
    public void setCols(int cols) {
        for (Enumeration e = spanTable.elements(); e.hasMoreElements();) {
            Object[] obj = (Object[]) e.nextElement();
            int colspan = ((Integer) obj[0]).intValue();
            if (colspan > cols) {
                return;
            }
        }
        this.cols = cols;
        valid = false;
    }

    /**
     * set "uniform" property
     * 
     * @param x
     *            uniform property for horizontal direction
     * @param y
     *            uniform property for vertical direction
     */
    public void setUniform(boolean x, boolean y) {
        xfix = x;
        yfix = y;
        valid = false;
    }

    /**
     * get "uniform" property
     * 
     * @return boolean array of "uniform property"
     */
    public boolean[] getUniform() {
        return new boolean[] { xfix, yfix };
    }

    /**
     * @param comp
     *            the component of which you want to change colspan
     * @param colspan
     *            the number of columns the component occupies
     */
    public void setColspan(Component comp, int colspan) {
        Object[] p = (Object[]) spanTable.get(comp);
        if (p != null) {
            p[0] = getInteger(colspan);
            spanTable.put(comp, p);
        } else {
            spanTable.put(comp, new Object[] { getInteger(colspan),
                    getInteger(1) });
        }
        invalidateLayout(comp.getParent());
    }

    /**
     * @param comp
     *            the component of which you want to get colspan
     * @return the value of "colspan" property
     */
    public int getColspan(Component comp) {
        Object o[] = (Object[]) spanTable.get(comp);
        if (o == null || o.length < 2) {
            return 1;
        } else {
            return ((Integer) o[0]).intValue();
        }
    }

    /**
     * @param comp
     *            the component of which you want to change rowspan
     * @param rowspan
     *            the number of rows the component occupies
     */
    public void setRowspan(Component comp, int rowspan) {
        Object[] p = (Object[]) spanTable.get(comp);
        if (p != null) {
            p[1] = getInteger(rowspan);
            spanTable.put(comp, p);
        } else {
            spanTable.put(comp, new Object[] { getInteger(1),
                    getInteger(rowspan) });
        }
        invalidateLayout(comp.getParent());
    }

    /**
     * @param comp
     *            the component of which you want to get rowspan
     * @return the value of "rowspan" property
     */
    public int getRowspan(Component comp) {
        Object o[] = (Object[]) spanTable.get(comp);
        if (o == null || o.length < 2) {
            return 1;
        } else {
            return ((Integer) o[1]).intValue();
        }
    }

    /**
     * @param comp
     *            the component of which you want to change alignment
     * @param align
     *            "left", "right", "fill", "center"
     */
    public void setHAlign(Component comp, String s) {
        int i = 0;
        if ("left".equalsIgnoreCase(s)) {
            i = LEFT;
        } else if ("right".equalsIgnoreCase(s)) {
            i = RIGHT;
        } else if ("fill".equalsIgnoreCase(s)) {
            i = H_FILL;
        } else {
            i = CENTER;
        }
        alignmentTable.put(comp, getInteger(i));
        invalidateLayout(comp.getParent());
    }

    /**
     * @param comp
     *            the component of which you want to change alignment
     * @param align
     *            "top", "bottom", "fill", "center"
     */
    public void setVAlign(Component comp, String s) {
        int i = 0;
        if ("left".equalsIgnoreCase(s)) {
            i = TOP;
        } else if ("bottom".equalsIgnoreCase(s)) {
            i = BOTTOM;
        } else if ("fill".equalsIgnoreCase(s)) {
            i = V_FILL;
        } else {
            i = CENTER;
        }
        alignmentTable.put(comp, getInteger(i));
        invalidateLayout(comp.getParent());
    }

    /**
     * @param comp
     *            the component of which you want to get alignment
     * @return "fill" | "left" | "right" | "center"
     */
    public String getHAlign(Component comp) {
        Integer it = (Integer) alignmentTable.get(comp);
        int i = this.align;
        if (it != null) {
            i = it.intValue();
        }
        if ((i & H_FILL) == H_FILL) {
            return "fill";
        }
        if ((i & LEFT) == LEFT) {
            return "left";
        }
        if ((i & RIGHT) == RIGHT) {
            return "right";
        }
        return "center";
    }

    /**
     * @param comp
     *            the component of which you want to get alignment
     * @return "fill" | "top" | "bottom" | "center"
     */
    public String getVAlign(Component comp) {
        Integer it = (Integer) alignmentTable.get(comp);
        int i = this.align;
        if (it != null) {
            i = it.intValue();
        }
        if ((i & V_FILL) == V_FILL) {
            return "fill";
        }
        if ((i & TOP) == TOP) {
            return "top";
        }
        if ((i & BOTTOM) == BOTTOM) {
            return "bottom";
        }
        return "center";
    }

    /**
     * @param comp
     *            the component of which you want to set "expand"
     */
    public void setExpand(Component comp, String ex) {
        Integer it = (Integer) alignmentTable.get(comp);
        int i = this.align;
        if (it != null) {
            i = it.intValue();
        }
        if ("x".equalsIgnoreCase(ex)) {
            i |= H_FIT;
        } else if ("y".equalsIgnoreCase(ex)) {
            i |= V_FIT;
        } else if ("xy".equalsIgnoreCase(ex)) {
            i |= H_FIT;
            i |= V_FIT;
        }
        alignmentTable.put(comp, getInteger(i));
        invalidateLayout(comp.getParent());
    }

    /**
     * @param comp
     *            the component of which you want to get "expand"
     * @return "x" | "y" | "xy" | ""
     */
    public String getExpand(Component comp) {
        Integer it = (Integer) alignmentTable.get(comp);
        int i = this.align;
        if (it != null) {
            i = it.intValue();
        }
        if ((i & (H_FIT | V_FIT)) == (H_FIT | V_FIT)) {
            return "xy";
        }
        if ((i & H_FIT) == H_FIT) {
            return "x";
        }
        if ((i & V_FIT) == V_FIT) {
            return "y";
        }
        return "";
    }

    /**
     * @param comp
     *            the component of which you want to change alignment
     * @param x
     *            "padx" property
     * @param y
     *            "pady" property
     */
    public void setPadding(Component comp, int x, int y) {
        padTable.put(comp, new Object[] { getInteger(x), getInteger(y) });
        invalidateLayout(comp.getParent());
    }

    /**
     * @param comp
     *            the component of which you want to get "padx"
     * @return the value of "padx" property
     */
    public int getPadX(Component comp) {
        Object[] pair = (Object[]) padTable.get(comp);
        if (pair != null) {
            return ((Integer) pair[0]).intValue();
        }
        return 0;
    }

    /**
     * @param comp
     *            the component of which you want to get "pady"
     * @return the value of "pady" property
     */
    public int getPadY(Component comp) {
        Object[] pair = (Object[]) padTable.get(comp);
        if (pair != null) {
            return ((Integer) pair[1]).intValue();
        }
        return 0;
    }

    /**
     * @param comp
     *            the component of which you want to change alignment
     * @param x
     *            "ipadx" property
     * @param y
     *            "ipady" property
     */
    public void setIPadding(Component comp, int x, int y) {
        iPadTable.put(comp, new Object[] { getInteger(x), getInteger(y) });
        invalidateLayout(comp.getParent());
    }

    /**
     * @param comp
     *            the component of which you want to get "ipadx"
     * @return the value of "ipadx" property
     */
    public int getIPadX(Component comp) {
        Object[] pair = (Object[]) iPadTable.get(comp);
        if (pair != null) {
            return ((Integer) pair[0]).intValue();
        }
        return 0;
    }

    /**
     * @param comp
     *            the component of which you want to get "ipady"
     * @return the value of "ipady" property
     */
    public int getIPadY(Component comp) {
        Object[] pair = (Object[]) iPadTable.get(comp);
        if (pair != null) {
            return ((Integer) pair[1]).intValue();
        }
        return 0;
    }

    void clear(int[] array, int len) {
        int i = 0;
        for (; i <= len - zero.length; i += zero.length) {
            System.arraycopy(zero, 0, array, i, zero.length);
        }
        System.arraycopy(zero, 0, array, i, len - i);
    }

    /**
     * Compute geometries that do not depend on the size of container
     */
    void bindContainer(Container target) {

        BitSet map[] = new BitSet[cols];
        for (int i = 0; i < cols; i++) {
            map[i] = new BitSet();
        }

        int nmembers = target.getComponentCount();

        int _k = 0;
        int _j = 0;
        int _l = 0;

        if (pos_x.length < nmembers) {
            pos_x = new int[nmembers * 2];
        }
        if (pos_y.length < nmembers) {
            pos_y = new int[nmembers * 2];
        }

        clear(pos_x, nmembers);
        clear(pos_y, nmembers);

        /**
         * 1) Decide components' logical location 2) Count total columns and
         * rows
         */
        for (int i = 0; i < nmembers; i++) {
            Component comp = target.getComponent(i);
            Object p[] = (Object[]) spanTable.get(comp);
            int colspan = 1;
            int rowspan = 1;
            if (p != null) {
                colspan = ((Integer) p[0]).intValue();
                rowspan = ((Integer) p[1]).intValue();
            }

            while (!fit(_j, _k, colspan, rowspan, map)) {
                if (++_j >= cols) {
                    _j = 0;
                    ++_k;
                }
            }
            pos_y[i] = _k;
            pos_x[i] = _j;

            for (int jj = 0; jj < colspan; jj++) {
                for (int kk = 0; kk < rowspan; kk++) {
                    map[_j + jj].set(_k + kk);
                }
            }

            if (_l < _k + rowspan) {
                _l = _k + rowspan;
            }

            if (++_j >= cols) {
                _j = 0;
                ++_k;
            }
        }
        rows = _l;

        grid_x = new int[cols + 1];
        grid_y = new int[rows + 1];
        widths = new int[cols];
        heights = new int[rows];
        vfit = new int[rows];
        hfit = new int[cols];
        int wmax = 0;
        int hmax = 0;

        /*
         * 3) Mark expanded locations.
         */
        for (int i = 0, j = 0, k = 0; i < nmembers; i++) {
            Component m = target.getComponent(i);
            k = pos_y[i];
            j = pos_x[i];
            int colspan = 1;
            int rowspan = 1;
            Object p[] = (Object[]) spanTable.get(m);
            if (p != null) {
                colspan = ((Integer) p[0]).intValue();
                rowspan = ((Integer) p[1]).intValue();
            }

            Object val = alignmentTable.get(m);
            int al = this.align;
            if (val != null && val instanceof Integer) {
                al = ((Integer) val).intValue();
            }

            if ((al & H_FIT) != 0) {
                for (int ii = 0; ii < colspan; ii++) {
                    hfit[j + ii] |= 1;
                }
            }
            if ((al & V_FIT) != 0) {
                for (int ii = 0; ii < rowspan; ii++) {
                    vfit[k + ii] |= 1;
                }
            }
            j += colspan;
            if (j >= cols) {
                j = 0;
                k++;
            }
        }

        /*
         * 4) Compute the size of cells
         */
        for (int i = 0; i < nmembers; i++) {
            Component m = target.getComponent(i);
            Dimension d = m.getPreferredSize();
            int d_width = d.width;
            int d_height = d.height;
            Object[] ip = (Object[]) iPadTable.get(m);
            if (ip != null) {
                d_width = d.width + ((Integer) ip[0]).intValue();
                d_height = d.height + ((Integer) ip[1]).intValue();
            }

            Object pd[] = (Object[]) padTable.get(m);
            int px = padx;
            int py = pady;
            if (pd != null) {
                px = ((Integer) pd[0]).intValue();
                py = ((Integer) pd[1]).intValue();
            }

            int j = pos_x[i];
            int k = pos_y[i];

            int colspan = 1;
            int rowspan = 1;
            Object p[] = (Object[]) spanTable.get(m);
            if (p != null) {
                colspan = ((Integer) p[0]).intValue();
                rowspan = ((Integer) p[1]).intValue();
            }

            int expand_count = 0;
            int no_expand_widths = 0;
            for (int ii = 0; ii < colspan; ii++) {
                if ((hfit[j + ii] & 1) != 0) { // expand is set
                    expand_count++;
                } else {
                    no_expand_widths += widths[j + ii];
                }
            }

            int _d = d_width + px * 2;
            if (colspan == 1) {
                if (_d > widths[j]) {
                    widths[j] = _d;
                }
                if (wmax < widths[j]) {
                    wmax = widths[j];
                }
            } else {
                for (int ii = 0; ii < colspan; ii++) {
                    if ((hfit[j + ii] & 1) != 0) { // expand is set
                        int _e = (_d - no_expand_widths) / expand_count;
                        if (_e > widths[j + ii]) {
                            widths[j + ii] = _e;
                        }
                    }
                    if (xfix) {
                        if (wmax < widths[j + ii]) {
                            wmax = widths[j + ii];
                        }
                    }
                }
            }

            if (heights[k] < (d_height + py * 2) / rowspan) {
                heights[k] = (d_height + py * 2) / rowspan;
                if (yfix) {
                    if (hmax < heights[k]) {
                        hmax = heights[k];
                    }
                }
            }
        }

        if (xfix) {
            for (int _m = 0; _m < cols; _m++) {
                widths[_m] = wmax;
            }
        }
        if (yfix) {
            for (int _m = 0; _m < rows; _m++) {
                heights[_m] = hmax;
            }
        }

        int w = 0;
        int h = 0;

        for (int j = 0; j < cols; j++) {
            w += widths[j];
        }
        for (int j = 0; j < rows; j++) {
            h += heights[j];
        }

        hfits = 0;
        for (int i = 0; i < hfit.length; i++) {
            if ((hfit[i] & 1) != 0) {
                hfits++;
            }
        }
        vfits = 0;
        for (int i = 0; i < vfit.length; i++) {
            if ((vfit[i] & 1) != 0) {
                vfits++;
            }
        }

        Insets insets = target.getInsets();
        w += insets.left + insets.right + padx * cols;
        h += insets.top + insets.bottom + pady * rows;
        psize = new Dimension(w, h);

        valid = true;
    }

    /**
     * Returns the preferred dimensions for this layout given the components in
     * the specified target container.
     * 
     * @param target
     *            the component which needs to be laid out
     * @see Container
     * @see #minimumLayoutSize
     */
    public Dimension preferredLayoutSize(Container target) {
        if (!valid) {
            bindContainer(target);
        }
        return psize;
    }

    /**
     * Returns the minimum dimensions needed to layout the components contained
     * in the specified target container.
     * 
     * @param target
     *            the component which needs to be laid out
     * @see #preferredLayoutSize
     */
    public Dimension minimumLayoutSize(Container target) {
        return preferredLayoutSize(target);
    }

    /**
     * Lays out the container. This method will actually reshape the components
     * in the target in order to satisfy the constraints of the BorderLayout
     * object.
     * 
     * @param target
     *            the specified component being laid out.
     * @see Container
     */
    public void layoutContainer(Container target) {
        Insets insets = target.getInsets();
        int nmembers = target.getComponentCount();
        if (!valid) {
            bindContainer(target);
        }

        int tw = target.getSize().width;
        int th = target.getSize().height;
        int pw = psize.width;
        int ph = psize.height;
        int aw = 0;
        int ah = 0;

        if (hfits > 0) {
            aw = (tw - pw) / hfits;
        }
        if (vfits > 0) {
            ah = (th - ph) / vfits;
        }

        int h = insets.top;
        int w = insets.left;

        grid_x[0] = w;

        for (int i = 1; i <= cols; i++) {
            grid_x[i] = grid_x[i - 1] + widths[i - 1] + padx;
            if ((hfit[i - 1] & 1) != 0) {
                grid_x[i] += aw;
            }
        }

        grid_y[0] = h;

        for (int i = 1; i <= rows; i++) {
            grid_y[i] = grid_y[i - 1] + heights[i - 1] + pady;
            if ((vfit[i - 1] & 1) != 0) {
                grid_y[i] += ah;
            }
        }

        for (int i = 0, j = 0, k = 0; i < nmembers; i++) {
            Component m = target.getComponent(i);
            Dimension d = m.getPreferredSize();
            int d_width = d.width;
            int d_height = d.height;
            Object[] ip = (Object[]) iPadTable.get(m);
            if (ip != null) {
                d_width = d.width + ((Integer) ip[0]).intValue();
                d_height = d.height + ((Integer) ip[1]).intValue();
            }

            k = pos_y[i];
            j = pos_x[i];

            int colspan = 1;
            int rowspan = 1;
            Object p[] = (Object[]) spanTable.get(m);
            if (p != null) {
                colspan = ((Integer) p[0]).intValue();
                rowspan = ((Integer) p[1]).intValue();
            }

            int al = this.align;
            Object val = alignmentTable.get(m);
            if (val != null && (val instanceof Integer)) {
                al = ((Integer) val).intValue();
            }
            int x, y;

            int dw = d_width;
            int dh = d_height;

            Object pt[] = (Object[]) padTable.get(m);
            int px = padx;
            int py = pady;
            if (pt != null) {
                px = ((Integer) pt[0]).intValue();
                py = ((Integer) pt[1]).intValue();
            }

            if ((al & LEFT) != 0) {
                x = grid_x[j] + px;
                if ((al & RIGHT) != 0) {
                    dw = grid_x[j + colspan] - grid_x[j] - px * 2;
                }
            } else if ((al & RIGHT) != 0) {
                x = grid_x[j + colspan] - dw - px;
            } else {
                x = (grid_x[j] + grid_x[j + colspan] - dw) / 2;
            }

            if ((al & TOP) != 0) {
                y = grid_y[k] + py;
                if ((al & BOTTOM) != 0) {
                    dh = grid_y[k + rowspan] - grid_y[k] - py * 2;
                }
            } else if ((al & BOTTOM) != 0) {
                y = grid_y[k + rowspan] - dh - py;
            } else {
                y = (grid_y[k] + grid_y[k + rowspan] - dh) / 2;
            }

            m.setBounds(x, y, dw, dh);
        }
    }

    boolean fit(int x, int y, int c, int r, BitSet[] map) {
        for (int i = 0; i < c; i++) {
            for (int j = 0; j < r; j++) {
                if (x + i >= cols) {
                    return false;
                }
                if (map[x + i].get(y + j)) {
                    return false;
                }
            }
        }
        return true;
    }

    static Hashtable str2table(String str) {
        Hashtable table = new Hashtable();
        StringTokenizer st = new StringTokenizer(str, ",");
        while (st.hasMoreTokens()) {
            String t = st.nextToken();
            StringTokenizer st2 = new StringTokenizer(t, "= ");
            String key = st2.nextToken();
            String value = st2.nextToken();
            table.put(key, value);
        }
        return table;
    }

    /**
     * Get the number of columns
     * 
     * @return the number of columns
     */
    public int getCols() {
        return cols;
    }

    /**
     * get the number of rows
     * 
     * @return the number of rows
     */
    public int getRows() {
        if (!valid) {
            throw new RuntimeException("PnutsLayout not valid");
        }
        return rows;
    }

    /**
     * get left-top point of the component(x,y)
     * 
     * @param x
     *            the index of column
     * @param y
     *            the index of row
     * @return left-top point of the component
     */
    public Point getGridPoint(Container target, int x, int y) {
        if (!valid) {
            return null;
        }
        return new Point(grid_x[x], grid_y[y]);
    }

    /**
     * get bounding-box for idx'th component
     * 
     * @param idx
     *            the index of the component
     * @return bounding-box as Rectangle object
     */
    public Rectangle getGridRectangle(Container target, int idx) {
        if (!valid) {
            return null;
        }
        int x = pos_x[idx];
        int y = pos_y[idx];
        int gx = grid_x[x];
        int gy = grid_y[y];
        Object s[] = (Object[]) spanTable.get(target.getComponent(idx));
        int sx = 1;
        int sy = 1;
        if (s != null) {
            sx = ((Integer) s[0]).intValue();
            sy = ((Integer) s[1]).intValue();
        }
        return new Rectangle(gx, gy, grid_x[x + sx] - gx, grid_y[y + sy] - gy);
    }

    /**
     * @return the String representation of this PnutsLayout's values.
     */
    public String toString() {
        return getClass().getName() + "[cols=" + cols + ",padx=" + padx
                + ",pady=" + pady + ",ipadx=" + ipadx + ",ipady=" + ipady + "]";
    }
}
