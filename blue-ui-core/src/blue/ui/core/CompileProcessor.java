/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue.ui.core;

import blue.BlueData;
import blue.BlueSystem;
import blue.projects.BlueProjectManager;
import blue.projects.actions.OpenProjectAction;
import blue.services.render.CSDRenderService;
import blue.services.render.CsdRenderResult;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.netbeans.api.sendopts.CommandException;
import org.netbeans.spi.sendopts.Env;
import org.netbeans.spi.sendopts.Option;
import org.netbeans.spi.sendopts.OptionGroups;
import org.netbeans.spi.sendopts.OptionProcessor;
import org.openide.util.lookup.ServiceProvider;

/**
 *
 * @author syi
 */

@ServiceProvider(service=OptionProcessor.class)
public class CompileProcessor extends OptionProcessor {
    private Option c = Option.requiredArgument('c', "compile");
    private Option o = Option.requiredArgument('o', "output");

    @Override
    protected Set<Option> getOptions() {
        Set<Option> options = new HashSet<Option>();
        
        c.shortDescription(o, "Bundle.properties", "option.compile.description");
        o.shortDescription(o, "Bundle.properties", "option.output.description");
        
        options.add(OptionGroups.allOf(c,o));
        
        return options;
    }

    @Override
    protected void process(Env env,
            Map<Option, String[]> optionValues) throws CommandException {

        String compileFileName = null;
        String outFileName = null;

        if(optionValues.containsKey(c)) {
            compileFileName = optionValues.get(c)[0];
        }

        if(optionValues.containsKey(o)) {
            outFileName = optionValues.get(o)[0];
        }

        if(compileFileName == null && outFileName == null) {
            return;
        }

        if(compileFileName == null && outFileName != null) {
            throw new CommandException(1, ".blue project not given as argument");
        }

        File in = new File(compileFileName);

        if (!in.exists() || !in.isFile()) {
            throw new CommandException(1, "Could not open .blue file: " + in.getAbsolutePath());
        }

        if (outFileName == null) {
            outFileName = compileFileName.substring(0, compileFileName
                    .indexOf(".blue"))
                    + ".csd";
        }

        OpenProjectAction.open(in);

        PrintWriter out = null;

        try {

            BlueData tempData = BlueProjectManager.getInstance().getCurrentBlueData();

            out = new PrintWriter(new BufferedWriter(
                    new FileWriter(outFileName)));
            CsdRenderResult renderResult =
                    CSDRenderService.getDefault().generateCSD(tempData, 0.0F, -1.0F, false);
            out.print(renderResult.getCsdText());
            out.close();

            throw new CommandException(0, compileFileName + " "
                    + BlueSystem.getString("blue.compiledTo") + " "
                    + outFileName);

        } catch (Exception e) {
            if (out != null) {
                out.close();
            }
            
            if(e instanceof CommandException) {
                throw (CommandException)e;
            }
            throw new CommandException(1, BlueSystem.getString("message.errorLabel") + " "
                    + BlueSystem.getString("blue.csdCompileError") + e.getMessage());
        }
    }

}
