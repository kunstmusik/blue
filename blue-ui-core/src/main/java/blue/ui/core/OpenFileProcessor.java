/*
 * blue - object composition environment for csound
 * Copyright (C) 2016
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.ui.core;

import blue.projects.actions.OpenProjectAction;
import java.io.File;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.logging.Logger;
import org.netbeans.api.sendopts.CommandException;
import org.netbeans.spi.sendopts.Env;
import org.netbeans.spi.sendopts.Option;
import org.netbeans.spi.sendopts.OptionProcessor;
import org.openide.util.Exceptions;
import org.openide.util.lookup.ServiceProvider;

/**
 *
 * @author stevenyi
 */
@ServiceProvider(service = OptionProcessor.class)
public class OpenFileProcessor extends OptionProcessor {

    private static final Logger log = Logger.getLogger(OpenFileProcessor.class.getName());

    private final Option c = Option.defaultArguments();

    @Override
    protected Set<Option> getOptions() {
        Set<Option> options = new HashSet<>();
        options.add(c);
        return options;
    }

    @Override
    protected void process(Env env, Map<Option, String[]> values) throws CommandException {
        String[] vals = values.get(c);

        if (vals != null) {
            for (String fName : vals) {

                File file = new File(fName);
                if (!file.isAbsolute()) {
                    file = new File(env.getCurrentDirectory(),
                            fName);
                }
                

                if (!file.exists()) {
                    try {
                        file = new File(new URI(fName));
                    } catch (URISyntaxException ex) {
                        file = null;
                    }
                }
                
                if (file == null || !file.exists()) {
                    log.warning("Can not open file: does not exist: " + fName);
                } else if (!file.getName().endsWith(".blue")) {
                    log.warning("Can not open non-Blue file: " + fName);
                } else {
                    log.info("Opening Blue project: " + fName);
                    OpenProjectAction.open(file);
                }
            }
        }
    }

}
